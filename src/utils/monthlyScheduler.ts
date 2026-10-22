import {
  ClosureHistory,
  ClosurePolicy,
  Member,
  MonthlyRoster,
  MonthRosterDay,
  Station,
  Weekday,
  WEEKDAYS,
  WeekSchedule,
} from '../types';
import {
  analyzeFeasibility,
  generateOptimalRoster,
  validateSchedule,
} from './scheduler';
import { getISOWeekInfo } from './storage';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Returns the exact number of days in a given year and month (1-indexed).
 * Correctly accounts for leap years in February (e.g. 2024 -> 29, 2025/2026 -> 28).
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Returns whether a given year is a leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Maps a Date or calendar components to Weekday enum.
 */
export function getWeekdayName(date: Date): Weekday {
  const dayIndex = date.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  const map: Weekday[] = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  return map[dayIndex];
}

/**
 * Formats a date into a clean display string like "01-Oct-2026".
 */
export function formatMonthDayDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const monthAbbr = MONTH_NAMES[date.getMonth()].slice(0, 3);
  const year = date.getFullYear();
  return `${day}-${monthAbbr}-${year}`;
}

/**
 * Generates a complete monthly roster based on the station setup, workforce assignments,
 * closure policy, and weekly scheduling engine.
 */
export function generateMonthlyRoster(
  year: number,
  month: number, // 1 to 12
  stations: Station[],
  members: Member[],
  policy: ClosurePolicy,
  existingSchedules: Record<string, WeekSchedule> = {},
  latestPublishedWeekId?: string
): MonthlyRoster {
  const monthIndex = month - 1;
  const monthName = MONTH_NAMES[monthIndex] || `Month ${month}`;
  const totalDays = getDaysInMonth(year, month);
  const stationIds = stations.map((s) => s.id);
  const stationNames = Object.fromEntries(stations.map((s) => [s.id, s.name]));

  // Check mathematical feasibility of the closure policy
  const feasibility = analyzeFeasibility(stations.length, policy);
  if (!feasibility.isFeasible || stations.length === 0) {
    return {
      month,
      year,
      monthName,
      totalDays,
      days: [],
      stations,
      policy,
      isFeasible: false,
      feasibilityReason:
        stations.length === 0
          ? 'No stations configured. Please add stations to generate a roster.'
          : feasibility.reason,
      generatedAt: Date.now(),
      isSynchronizedWithWeekly: false,
    };
  }

  // Filter existing schedules: only valid and published schedules are authoritative.
  // Unpublished draft changes must NEVER leak into the monthly roster.
  const publishedSchedulesMap: Record<string, WeekSchedule> = {};
  for (const [wId, sched] of Object.entries(existingSchedules)) {
    if (sched && sched.isPublished && sched.isValid && sched.assignments) {
      publishedSchedulesMap[wId] = sched;
    }
  }

  // Resolve the authoritative published weekly roster
  let authoritativePublishedSchedule: WeekSchedule | undefined = undefined;
  if (latestPublishedWeekId && publishedSchedulesMap[latestPublishedWeekId]) {
    authoritativePublishedSchedule = publishedSchedulesMap[latestPublishedWeekId];
  } else {
    const sorted = Object.values(publishedSchedulesMap).sort(
      (a, b) => (b.lastModified || 0) - (a.lastModified || 0)
    );
    if (sorted.length > 0) {
      authoritativePublishedSchedule = sorted[0];
    }
  }

  const resolvedWeeklySchedules: Record<string, WeekSchedule> = {};
  const historyForFairness: ClosureHistory = {};

  // Initialize fairness history
  for (const sId of stationIds) {
    historyForFairness[sId] = {
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
      Sunday: 0,
    };
  }

  // Populate history from existing published schedules
  for (const sched of Object.values(publishedSchedulesMap)) {
    if (sched.assignments) {
      for (const d of WEEKDAYS) {
        for (const sId of stationIds) {
          if (sched.assignments[d]?.[sId]) {
            historyForFairness[sId][d]++;
          }
        }
      }
    }
  }

  // Identify all ISO weeks needed for the month's calendar dates
  for (let day = 1; day <= totalDays; day++) {
    const calendarDate = new Date(year, monthIndex, day);
    const weekInfo = getISOWeekInfo(calendarDate);

    if (!resolvedWeeklySchedules[weekInfo.weekId]) {
      // 1. If this exact ISO week has an authoritative published schedule, use it directly
      if (publishedSchedulesMap[weekInfo.weekId]) {
        resolvedWeeklySchedules[weekInfo.weekId] = publishedSchedulesMap[weekInfo.weekId];
      } else if (authoritativePublishedSchedule) {
        // 2. Otherwise, synchronize using the latest authoritative published weekly roster pattern
        resolvedWeeklySchedules[weekInfo.weekId] = {
          weekId: weekInfo.weekId,
          weekNumber: weekInfo.weekNumber,
          year: weekInfo.year,
          startDate: weekInfo.mondayDate,
          assignments: authoritativePublishedSchedule.assignments,
          isPublished: true,
          isValid: true,
          validationErrors: [],
          lastModified: authoritativePublishedSchedule.lastModified,
        };
      } else {
        // 3. Fallback when no published schedule exists: generate optimal roster with fairness rotation
        const generated = generateOptimalRoster(stationIds, policy, historyForFairness);
        const errors = validateSchedule(stationIds, stationNames, policy, generated.assignments);

        resolvedWeeklySchedules[weekInfo.weekId] = {
          weekId: weekInfo.weekId,
          weekNumber: weekInfo.weekNumber,
          year: weekInfo.year,
          startDate: weekInfo.mondayDate,
          assignments: generated.assignments,
          isPublished: false,
          isValid: errors.length === 0,
          validationErrors: errors,
          lastModified: Date.now(),
        };

        // Accumulate into history for subsequent weeks' fairness rotation
        for (const d of WEEKDAYS) {
          for (const sId of stationIds) {
            if (generated.assignments[d]?.[sId]) {
              historyForFairness[sId][d]++;
            }
          }
        }
      }
    }
  }

  // Pre-group members by station
  const stationMembersMap: Record<string, Member[]> = {};
  for (const s of stations) {
    stationMembersMap[s.id] = members.filter((m) => m.stationId === s.id);
  }

  // Build every calendar day in the month
  const days: MonthRosterDay[] = [];

  for (let day = 1; day <= totalDays; day++) {
    const calendarDate = new Date(year, monthIndex, day);
    const weekday = getWeekdayName(calendarDate);
    const isWeekend = weekday === 'Saturday' || weekday === 'Sunday';
    const weekInfo = getISOWeekInfo(calendarDate);
    const weekSched = resolvedWeeklySchedules[weekInfo.weekId];

    const isoDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const formattedDate = formatMonthDayDate(calendarDate);

    const stationStatuses: Record<string, { isClosed: boolean; assignedMembers: Member[]; statusLabel: 'OPEN' | 'CLOSED' }> = {};

    for (const s of stations) {
      const isClosed = weekSched?.assignments[weekday]?.[s.id] === true;
      const assigned = stationMembersMap[s.id] || [];

      stationStatuses[s.id] = {
        isClosed,
        assignedMembers: assigned,
        statusLabel: isClosed ? 'CLOSED' : 'OPEN',
      };
    }

    days.push({
      date: isoDateStr,
      dayNumber: day,
      weekday,
      isWeekend,
      formattedDate,
      stations: stationStatuses,
    });
  }

  return {
    month,
    year,
    monthName,
    totalDays,
    days,
    stations,
    policy,
    isFeasible: true,
    generatedAt: Date.now(),
    sourceScheduleWeekId: authoritativePublishedSchedule?.weekId,
    lastSynchronizedAt: authoritativePublishedSchedule?.lastModified,
    isSynchronizedWithWeekly: !!authoritativePublishedSchedule,
  };
}
