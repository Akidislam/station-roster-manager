export type Weekday = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export const WEEKDAYS: Weekday[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

/**
 * Critical station staffing rule: Each station can have at most 3 members (0, 1, 2, or 3).
 * A 4th member is strictly prohibited.
 */
export const MAX_MEMBERS_PER_STATION = 3;

export interface Member {
  id: string;
  name: string;
  role?: string;
  stationId: string | null; // null if unassigned
  createdAt: number;
}

export interface Station {
  id: string;
  name: string;
  color?: string;
  workingHours?: string; // e.g. "08:00 - 17:00"
  breakTime?: string;    // e.g. "13:00 - 14:00"
  createdAt: number;
}

export interface MonthRosterStationStatus {
  isClosed: boolean;
  assignedMembers: Member[];
  statusLabel: 'OPEN' | 'CLOSED';
}

export interface MonthRosterDay {
  date: string; // ISO date string YYYY-MM-DD
  dayNumber: number; // 1 to 31
  weekday: Weekday;
  isWeekend: boolean; // Saturday or Sunday
  formattedDate: string; // e.g. "01-Oct-2026"
  // stationId -> status and members
  stations: Record<string, MonthRosterStationStatus>;
}

export interface MonthlyRoster {
  month: number; // 1 to 12
  year: number; // e.g. 2026
  monthName: string; // e.g. "October"
  totalDays: number;
  days: MonthRosterDay[];
  stations: Station[];
  policy: ClosurePolicy;
  isFeasible: boolean;
  feasibilityReason?: string;
  generatedAt: number;
  sourceScheduleWeekId?: string;
  lastSynchronizedAt?: number;
  isSynchronizedWithWeekly?: boolean;
}

export interface ClosurePolicy {
  // Map of weekday to boolean (true = closures allowed on this day)
  allowedClosureDays: Record<Weekday, boolean>;
  // Required closure days per station per week (default 2)
  closuresPerStation: number;
  // Minimum open stations required each day
  minOpenStationsPerDay: number;
  // Calculated or explicitly set maximum closures per day
  maxClosuresPerDay?: number;
}

export interface DailyStationStatus {
  stationId: string;
  isClosed: boolean; // true = closed (holiday for members of this station)
}

export type ClosureHistory = Record<string, Record<Weekday, number>>;

export interface WeekSchedule {
  weekId: string; // e.g. "2026-W43"
  weekNumber: number;
  year: number;
  startDate: string; // ISO date string of Monday
  // Day -> stationId -> isClosed
  assignments: Record<Weekday, Record<string, boolean>>;
  isPublished: boolean;
  isValid: boolean;
  validationErrors: string[];
  lastModified: number;
}

export interface FeasibilityResult {
  isFeasible: boolean;
  reason: string;
  proof?: {
    totalStations: number;
    closuresRequiredPerStation: number;
    totalClosuresRequired: number;
    eligibleDaysCount: number;
    minOpenStations: number;
    maxClosuresPerDay: number;
    maxPossibleClosures: number;
    deficit?: number;
  };
  suggestedPolicies?: SuggestedPolicy[];
}

export interface SuggestedPolicy {
  id: string;
  title: string;
  description: string;
  allowedClosureDays: Record<Weekday, boolean>;
  minOpenStationsPerDay: number;
  closuresPerStation: number;
  maxCapacity: number;
  requiredCapacity: number;
}

export interface AppDataSchema {
  version: number;
  stations: Station[];
  members: Member[];
  declaredTotalMembers: number;
  policy: ClosurePolicy;
  schedules: Record<string, WeekSchedule>;
  currentWeekId: string;
  latestPublishedWeekId?: string;
  lastPublishedAt?: number;
  isWizardCompleted: boolean;
  updatedAt: number;
}
