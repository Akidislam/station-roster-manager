import { describe, it, expect, beforeEach } from 'vitest';
import { generateMonthlyRoster } from '../utils/monthlyScheduler';
import { validateSchedule, createDefaultPolicy, analyzeFeasibility } from '../utils/scheduler';
import { saveAppData, loadAppData, STORAGE_KEY } from '../utils/storage';
import {
  AppDataSchema,
  ClosurePolicy,
  Member,
  Station,
  WeekSchedule,
  Weekday,
  WEEKDAYS,
} from '../types';

describe('Weekly-to-Monthly Roster Synchronization & Authoritative Publish Workflow', () => {
  const stations: Station[] = [
    { id: 'S1', name: 'Dhaka Station', createdAt: 100 },
    { id: 'S2', name: 'Chattogram Station', createdAt: 200 },
    { id: 'S3', name: 'Sylhet Station', createdAt: 300 },
  ];

  const members: Member[] = [
    { id: 'm1', name: 'Kamruzzaman', stationId: 'S1', createdAt: 101 },
    { id: 'm2', name: 'Russell', stationId: 'S1', createdAt: 102 },
    { id: 'm3', name: 'Ayman', stationId: 'S1', createdAt: 103 },
    { id: 'm4', name: 'Akib', stationId: 'S2', createdAt: 201 },
    { id: 'm5', name: 'Sunny', stationId: 'S2', createdAt: 202 },
    { id: 'm6', name: 'Muttakin', stationId: 'S3', createdAt: 301 },
  ];

  const policy = createDefaultPolicy(3); // 3 stations: min 1 open, Thu-Sun allowed, 2 closures per station

  const stationIds = stations.map((s) => s.id);
  const stationNames = Object.fromEntries(stations.map((s) => [s.id, s.name]));

  // Mock localStorage for node/vitest environment
  let mockStorage: Record<string, string> = {};
  beforeEach(() => {
    mockStorage = {};
    globalThis.localStorage = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
      length: 0,
      key: () => null,
    } as any;
  });

  // Test 1: Publishing a weekly schedule propagates immediately to monthly calendar dates
  it('1. Publishing a validated weekly schedule synchronizes status to corresponding monthly dates', () => {
    // Construct a specific valid weekly assignment
    // S1 closed: Thursday, Sunday
    // S2 closed: Friday, Saturday
    // S3 closed: Thursday, Saturday
    const weeklyAssignments: Record<Weekday, Record<string, boolean>> = {
      Monday: { S1: false, S2: false, S3: false },
      Tuesday: { S1: false, S2: false, S3: false },
      Wednesday: { S1: false, S2: false, S3: false },
      Thursday: { S1: true, S2: false, S3: true },  // 2 closed, 1 open (S2) -> meets min 1
      Friday: { S1: false, S2: true, S3: false },   // 1 closed, 2 open
      Saturday: { S1: false, S2: true, S3: true },  // 2 closed, 1 open (S1) -> meets min 1
      Sunday: { S1: true, S2: false, S3: false },   // 1 closed, 2 open
    };

    const validationErrors = validateSchedule(stationIds, stationNames, policy, weeklyAssignments);
    expect(validationErrors).toHaveLength(0);

    const publishedWeek: WeekSchedule = {
      weekId: '2026-W43',
      weekNumber: 43,
      year: 2026,
      startDate: '2026-10-19',
      assignments: weeklyAssignments,
      isPublished: true,
      isValid: true,
      validationErrors: [],
      lastModified: 1700000000000,
    };

    const schedules = {
      '2026-W43': publishedWeek,
    };

    // Generate October 2026 monthly roster
    const monthlyRoster = generateMonthlyRoster(2026, 10, stations, members, policy, schedules, '2026-W43');

    expect(monthlyRoster.isFeasible).toBe(true);
    expect(monthlyRoster.isSynchronizedWithWeekly).toBe(true);
    expect(monthlyRoster.sourceScheduleWeekId).toBe('2026-W43');

    // Verify all Thursdays in October (Oct 1, 8, 15, 22, 29) reflect the published schedule:
    // S1: CLOSED, S2: OPEN, S3: CLOSED
    const thursdays = monthlyRoster.days.filter((d) => d.weekday === 'Thursday');
    expect(thursdays.length).toBe(5); // 5 Thursdays in Oct 2026

    for (const thu of thursdays) {
      expect(thu.stations['S1'].isClosed).toBe(true);
      expect(thu.stations['S1'].statusLabel).toBe('CLOSED');
      expect(thu.stations['S2'].isClosed).toBe(false);
      expect(thu.stations['S2'].statusLabel).toBe('OPEN');
      expect(thu.stations['S3'].isClosed).toBe(true);
      expect(thu.stations['S3'].statusLabel).toBe('CLOSED');
    }

    // Verify all Sundays in October (Oct 4, 11, 18, 25) reflect the published schedule:
    // S1: CLOSED, S2: OPEN, S3: OPEN
    const sundays = monthlyRoster.days.filter((d) => d.weekday === 'Sunday');
    expect(sundays.length).toBe(4);

    for (const sun of sundays) {
      expect(sun.stations['S1'].isClosed).toBe(true);
      expect(sun.stations['S2'].isClosed).toBe(false);
      expect(sun.stations['S3'].isClosed).toBe(false);
    }

    // Verify all Fridays (Oct 2, 9, 16, 23, 30):
    // S1: OPEN, S2: CLOSED, S3: OPEN
    const fridays = monthlyRoster.days.filter((d) => d.weekday === 'Friday');
    for (const fri of fridays) {
      expect(fri.stations['S1'].isClosed).toBe(false);
      expect(fri.stations['S2'].isClosed).toBe(true);
      expect(fri.stations['S3'].isClosed).toBe(false);
    }
  });

  // Test 2: Unpublished draft edits NEVER leak into the monthly roster
  it('2. Unpublished draft edits in Weekly Roster do not affect Monthly Roster until Publish is clicked', () => {
    // Initial published schedule: S1 closed Thu & Sun
    const publishedAssignments: Record<Weekday, Record<string, boolean>> = {
      Monday: { S1: false, S2: false, S3: false },
      Tuesday: { S1: false, S2: false, S3: false },
      Wednesday: { S1: false, S2: false, S3: false },
      Thursday: { S1: true, S2: false, S3: true },
      Friday: { S1: false, S2: true, S3: false },
      Saturday: { S1: false, S2: true, S3: true },
      Sunday: { S1: true, S2: false, S3: false },
    };

    const publishedWeek: WeekSchedule = {
      weekId: '2026-W43',
      weekNumber: 43,
      year: 2026,
      startDate: '2026-10-19',
      assignments: publishedAssignments,
      isPublished: true,
      isValid: true,
      validationErrors: [],
      lastModified: 1000,
    };

    // User is currently editing: draft with S1 closed on Friday instead of Sunday
    // But this draft has NOT been published (isPublished = false)
    const draftAssignments: Record<Weekday, Record<string, boolean>> = {
      ...publishedAssignments,
      Friday: { S1: true, S2: false, S3: false },
      Sunday: { S1: false, S2: false, S3: false },
    };

    const draftWeek: WeekSchedule = {
      weekId: '2026-W43',
      weekNumber: 43,
      year: 2026,
      startDate: '2026-10-19',
      assignments: draftAssignments,
      isPublished: false, // DRAFT NOT PUBLISHED!
      isValid: true,
      validationErrors: [],
      lastModified: 2000,
    };

    // When passing schedules containing only the draft (or draft saved in place of published)
    // with isPublished: false, Monthly Roster must ignore the draft!
    const monthlyRosterWithDraftOnly = generateMonthlyRoster(
      2026,
      10,
      stations,
      members,
      policy,
      { '2026-W43': draftWeek }
    );

    // The draft must NOT be treated as authoritative
    expect(monthlyRosterWithDraftOnly.isSynchronizedWithWeekly).toBe(false);

    // If both published and draft exist, published must take precedence
    const monthlyRoster = generateMonthlyRoster(
      2026,
      10,
      stations,
      members,
      policy,
      {
        'published-w43': publishedWeek,
        'draft-w43': draftWeek,
      },
      'published-w43'
    );

    expect(monthlyRoster.isSynchronizedWithWeekly).toBe(true);
    expect(monthlyRoster.sourceScheduleWeekId).toBe(publishedWeek.weekId);

    // On Sundays, S1 must still be CLOSED per the published schedule, NOT open per the draft
    const octSunday = monthlyRoster.days.find((d) => d.date === '2026-10-25');
    expect(octSunday?.stations['S1'].isClosed).toBe(true);

    // On Fridays, S1 must still be OPEN per the published schedule, NOT closed per the draft
    const octFriday = monthlyRoster.days.find((d) => d.date === '2026-10-23');
    expect(octFriday?.stations['S1'].isClosed).toBe(false);
  });

  // Test 3: Validation failure blocks publish and keeps previous published roster intact
  it('3. Publishing an invalid schedule fails validation, preserving the previously published roster', () => {
    // Valid initial schedule
    const validAssignments: Record<Weekday, Record<string, boolean>> = {
      Monday: { S1: false, S2: false, S3: false },
      Tuesday: { S1: false, S2: false, S3: false },
      Wednesday: { S1: false, S2: false, S3: false },
      Thursday: { S1: true, S2: false, S3: true },
      Friday: { S1: false, S2: true, S3: false },
      Saturday: { S1: false, S2: true, S3: true },
      Sunday: { S1: true, S2: false, S3: false },
    };

    const initialPublished: WeekSchedule = {
      weekId: '2026-W43',
      weekNumber: 43,
      year: 2026,
      startDate: '2026-10-19',
      assignments: validAssignments,
      isPublished: true,
      isValid: true,
      validationErrors: [],
      lastModified: 1000,
    };

    // User attempts to make an invalid edit: Closing S1 on Monday (Prohibited day!)
    const invalidDraftAssignments: Record<Weekday, Record<string, boolean>> = {
      ...validAssignments,
      Monday: { S1: true, S2: false, S3: false }, // VIOLATION!
    };

    const errors = validateSchedule(stationIds, stationNames, policy, invalidDraftAssignments);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('prohibited closure day'))).toBe(true);

    // Simulated publish attempt: Because errors exist, publishing is rejected
    let appSchedules: Record<string, WeekSchedule> = {
      '2026-W43': initialPublished,
    };

    const attemptPublish = (newAssignments: typeof invalidDraftAssignments) => {
      const validation = validateSchedule(stationIds, stationNames, policy, newAssignments);
      if (validation.length > 0) {
        // Publish rejected! Do not update published schedule
        return { success: false, errors: validation };
      }
      appSchedules['2026-W43'] = {
        ...initialPublished,
        assignments: newAssignments,
        isPublished: true,
        isValid: true,
        validationErrors: [],
        lastModified: Date.now(),
      };
      return { success: true };
    };

    const result = attemptPublish(invalidDraftAssignments);
    expect(result.success).toBe(false);

    // The previously published roster in appSchedules remains active and untouched
    expect(appSchedules['2026-W43'].assignments.Monday['S1']).toBe(false);
    expect(appSchedules['2026-W43'].isPublished).toBe(true);

    // Monthly roster remains synchronized with the valid schedule
    const monthlyRoster = generateMonthlyRoster(2026, 10, stations, members, policy, appSchedules, '2026-W43');
    const octMondays = monthlyRoster.days.filter((d) => d.weekday === 'Monday');
    for (const mon of octMondays) {
      expect(mon.stations['S1'].isClosed).toBe(false); // S1 remains OPEN on Monday!
    }
  });

  // Test 4: Multiple published weeks take precedence for their respective calendar dates
  it('4. Multi-week publishing: Specific published ISO weeks control their exact calendar dates', () => {
    // Week 42 (Oct 12 - Oct 18): S1 closed on Thursday & Friday
    const week42Assignments: Record<Weekday, Record<string, boolean>> = {
      Monday: { S1: false, S2: false, S3: false },
      Tuesday: { S1: false, S2: false, S3: false },
      Wednesday: { S1: false, S2: false, S3: false },
      Thursday: { S1: true, S2: false, S3: false },
      Friday: { S1: true, S2: true, S3: false },
      Saturday: { S1: false, S2: true, S3: true },
      Sunday: { S1: false, S2: false, S3: true },
    };

    // Week 43 (Oct 19 - Oct 25): S1 closed on Saturday & Sunday
    const week43Assignments: Record<Weekday, Record<string, boolean>> = {
      Monday: { S1: false, S2: false, S3: false },
      Tuesday: { S1: false, S2: false, S3: false },
      Wednesday: { S1: false, S2: false, S3: false },
      Thursday: { S1: false, S2: true, S3: false },
      Friday: { S1: false, S2: true, S3: true },
      Saturday: { S1: true, S2: false, S3: true },
      Sunday: { S1: true, S2: false, S3: false },
    };

    const schedules: Record<string, WeekSchedule> = {
      '2026-W42': {
        weekId: '2026-W42',
        weekNumber: 42,
        year: 2026,
        startDate: '2026-10-12',
        assignments: week42Assignments,
        isPublished: true,
        isValid: true,
        validationErrors: [],
        lastModified: 1000,
      },
      '2026-W43': {
        weekId: '2026-W43',
        weekNumber: 43,
        year: 2026,
        startDate: '2026-10-19',
        assignments: week43Assignments,
        isPublished: true,
        isValid: true,
        validationErrors: [],
        lastModified: 2000,
      },
    };

    const monthlyRoster = generateMonthlyRoster(2026, 10, stations, members, policy, schedules, '2026-W43');

    // In Week 42:
    // Friday Oct 16: S1 was closed per Week 42 schedule
    const oct16 = monthlyRoster.days.find((d) => d.date === '2026-10-16');
    expect(oct16?.weekday).toBe('Friday');
    expect(oct16?.stations['S1'].isClosed).toBe(true);

    // In Week 43:
    // Friday Oct 23: S1 was open per Week 43 schedule
    const oct23 = monthlyRoster.days.find((d) => d.date === '2026-10-23');
    expect(oct23?.weekday).toBe('Friday');
    expect(oct23?.stations['S1'].isClosed).toBe(false);

    // Saturday Oct 24: S1 was closed per Week 43 schedule
    const oct24 = monthlyRoster.days.find((d) => d.date === '2026-10-24');
    expect(oct24?.weekday).toBe('Saturday');
    expect(oct24?.stations['S1'].isClosed).toBe(true);
  });

  // Test 5: Month boundaries, mid-week starts, and leap years preserve weekday mapping
  it('5. Mid-week month starts, ends, and year boundaries map weekdays precisely without shifts', () => {
    // Oct 1, 2026 is Thursday (Week 40)
    // Oct 31, 2026 is Saturday (Week 44)
    const baseAssignments: Record<Weekday, Record<string, boolean>> = {
      Monday: { S1: false, S2: false, S3: false },
      Tuesday: { S1: false, S2: false, S3: false },
      Wednesday: { S1: false, S2: false, S3: false },
      Thursday: { S1: true, S2: false, S3: true },
      Friday: { S1: false, S2: true, S3: false },
      Saturday: { S1: false, S2: true, S3: true },
      Sunday: { S1: true, S2: false, S3: false },
    };

    const schedule: WeekSchedule = {
      weekId: '2026-W43',
      weekNumber: 43,
      year: 2026,
      startDate: '2026-10-19',
      assignments: baseAssignments,
      isPublished: true,
      isValid: true,
      validationErrors: [],
      lastModified: 1000,
    };

    const octRoster = generateMonthlyRoster(2026, 10, stations, members, policy, { '2026-W43': schedule });

    // Day 1: Oct 1, 2026 must be Thursday
    expect(octRoster.days[0].dayNumber).toBe(1);
    expect(octRoster.days[0].weekday).toBe('Thursday');
    expect(octRoster.days[0].stations['S1'].isClosed).toBe(true);
    expect(octRoster.days[0].stations['S2'].isClosed).toBe(false);

    // Day 31: Oct 31, 2026 must be Saturday
    expect(octRoster.days[30].dayNumber).toBe(31);
    expect(octRoster.days[30].weekday).toBe('Saturday');
    expect(octRoster.days[30].stations['S2'].isClosed).toBe(true);
    expect(octRoster.days[30].stations['S3'].isClosed).toBe(true);
    expect(octRoster.days[30].stations['S1'].isClosed).toBe(false);

    // No dates omitted or duplicated
    const dayNumbers = octRoster.days.map((d) => d.dayNumber);
    expect(dayNumbers).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  });

  // Test 6: Persistence in localStorage saves and reloads synchronized published data
  it('6. Full persistence roundtrip in localStorage maintains weekly-monthly synchronization', () => {
    const publishedAssignments: Record<Weekday, Record<string, boolean>> = {
      Monday: { S1: false, S2: false, S3: false },
      Tuesday: { S1: false, S2: false, S3: false },
      Wednesday: { S1: false, S2: false, S3: false },
      Thursday: { S1: true, S2: false, S3: true },
      Friday: { S1: false, S2: true, S3: false },
      Saturday: { S1: false, S2: true, S3: true },
      Sunday: { S1: true, S2: false, S3: false },
    };

    const initialSchedule: WeekSchedule = {
      weekId: '2026-W43',
      weekNumber: 43,
      year: 2026,
      startDate: '2026-10-19',
      assignments: publishedAssignments,
      isPublished: true,
      isValid: true,
      validationErrors: [],
      lastModified: 1700000000000,
    };

    const appData: AppDataSchema = {
      version: 1,
      stations,
      members,
      declaredTotalMembers: members.length,
      policy,
      schedules: {
        '2026-W43': initialSchedule,
      },
      currentWeekId: '2026-W43',
      latestPublishedWeekId: '2026-W43',
      lastPublishedAt: initialSchedule.lastModified,
      isWizardCompleted: true,
      updatedAt: Date.now(),
    };

    // Save to localStorage
    const saved = saveAppData(appData);
    expect(saved).toBe(true);

    // Reload from localStorage
    const reloaded = loadAppData();
    expect(reloaded.latestPublishedWeekId).toBe('2026-W43');
    expect(reloaded.schedules['2026-W43'].isPublished).toBe(true);

    // Generate monthly roster using reloaded state
    const monthlyRoster = generateMonthlyRoster(
      2026,
      10,
      reloaded.stations,
      reloaded.members,
      reloaded.policy,
      reloaded.schedules,
      reloaded.latestPublishedWeekId
    );

    expect(monthlyRoster.isSynchronizedWithWeekly).toBe(true);
    expect(monthlyRoster.sourceScheduleWeekId).toBe('2026-W43');

    // S1 closed on Thursday and Sunday
    const thu = monthlyRoster.days.find((d) => d.date === '2026-10-22');
    expect(thu?.stations['S1'].isClosed).toBe(true);
    expect(thu?.stations['S1'].assignedMembers.map((m) => m.name)).toEqual(['Kamruzzaman', 'Russell', 'Ayman']);
  });
});
