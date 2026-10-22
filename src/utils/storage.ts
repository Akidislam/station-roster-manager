import { AppDataSchema, ClosurePolicy, Member, Station, WeekSchedule, WEEKDAYS, MAX_MEMBERS_PER_STATION } from '../types';
import { createDefaultPolicy, generateOptimalRoster, validateSchedule } from './scheduler';

export const STORAGE_KEY = 'station_roster_data_v1';
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Returns the ISO week identifier e.g. "2026-W43" and starting Monday date
 */
export function getISOWeekInfo(date: Date = new Date()): { weekId: string; weekNumber: number; year: number; mondayDate: string } {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7; // Monday is 0, Sunday is 6
  target.setDate(target.getDate() - dayNr + 3); // Nearest Thursday
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  const year = new Date(firstThursday).getFullYear();

  // Find Monday date of this week
  const monday = new Date(date);
  monday.setDate(date.getDate() - dayNr);
  const mondayDate = monday.toISOString().split('T')[0];

  const weekId = `${year}-W${String(weekNumber).padStart(2, '0')}`;
  return { weekId, weekNumber, year, mondayDate };
}

/**
 * Generates dates for each weekday given a Monday start date string (YYYY-MM-DD)
 */
export function getWeekDates(mondayStr: string): Record<string, string> {
  const dates: Record<string, string> = {};
  const monday = new Date(mondayStr + 'T00:00:00');
  
  WEEKDAYS.forEach((day, index) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + index);
    dates[day] = d.toISOString().split('T')[0];
  });
  
  return dates;
}

/**
 * Formats date into readable string e.g. "Oct 26, 2026"
 */
export function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
/**
 * Generates an initial clean state for first-time users.
 * Stations and members are empty so the user manually configures them.
 */
export function createInitialData(): AppDataSchema {
  const currentWeek = getISOWeekInfo();
  const defaultPolicy = createDefaultPolicy(3);

  return {
    version: CURRENT_SCHEMA_VERSION,
    stations: [],
    members: [],
    declaredTotalMembers: 0,
    policy: defaultPolicy,
    schedules: {},
    currentWeekId: currentWeek.weekId,
    isWizardCompleted: false, // Must be false for first-time setup!
    updatedAt: Date.now(),
  };
}

/**
 * Optional sample demo dataset for testing or demonstrations.
 */
export function createSampleDemoData(): AppDataSchema {
  const currentWeek = getISOWeekInfo();

  const stations: Station[] = [
    { id: 'st-dhaka', name: 'Dhaka Station', color: 'indigo', createdAt: Date.now() },
    { id: 'st-chattogram', name: 'Chattogram Station', color: 'emerald', createdAt: Date.now() + 1 },
    { id: 'st-sylhet', name: 'Sylhet Station', color: 'amber', createdAt: Date.now() + 2 },
  ];

  const members: Member[] = [
    { id: 'm-1', name: 'Kamruzzaman', role: 'Member', stationId: 'st-dhaka', createdAt: Date.now() },
    { id: 'm-2', name: 'Russell', role: 'Member', stationId: 'st-dhaka', createdAt: Date.now() + 1 },
    { id: 'm-3', name: 'Ayman', role: 'Member', stationId: 'st-dhaka', createdAt: Date.now() + 2 },
    { id: 'm-4', name: 'Akib', role: 'Member', stationId: 'st-chattogram', createdAt: Date.now() + 3 },
    { id: 'm-5', name: 'Sunny', role: 'Member', stationId: 'st-chattogram', createdAt: Date.now() + 4 },
    { id: 'm-6', name: 'Muttakin', role: 'Member', stationId: 'st-sylhet', createdAt: Date.now() + 5 },
    { id: 'm-7', name: 'Sayed', role: 'Member', stationId: 'st-sylhet', createdAt: Date.now() + 6 },
    { id: 'm-8', name: 'Amit', role: 'Member', stationId: 'st-sylhet', createdAt: Date.now() + 7 },
  ];

  const policy = createDefaultPolicy(3); // 3 stations -> min 1 open, Thu-Sun allowed
  const stationIds = stations.map((s) => s.id);
  const stationNames = Object.fromEntries(stations.map((s) => [s.id, s.name]));

  const rosterGen = generateOptimalRoster(stationIds, policy);
  const validationErrors = validateSchedule(stationIds, stationNames, policy, rosterGen.assignments);

  const initialSchedule: WeekSchedule = {
    weekId: currentWeek.weekId,
    weekNumber: currentWeek.weekNumber,
    year: currentWeek.year,
    startDate: currentWeek.mondayDate,
    assignments: rosterGen.assignments,
    isPublished: true,
    isValid: validationErrors.length === 0,
    validationErrors,
    lastModified: Date.now(),
  };

  return {
    version: CURRENT_SCHEMA_VERSION,
    stations,
    members,
    declaredTotalMembers: members.length,
    policy,
    schedules: {
      [currentWeek.weekId]: initialSchedule,
    },
    currentWeekId: currentWeek.weekId,
    latestPublishedWeekId: currentWeek.weekId,
    lastPublishedAt: initialSchedule.lastModified,
    isWizardCompleted: true,
    updatedAt: Date.now(),
  };
}

/**
 * Loads data from localStorage with graceful fallback and schema verification.
 */
export function loadAppData(): AppDataSchema {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createInitialData();
      saveAppData(initial);
      return initial;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.stations)) {
      console.warn('Corrupted local storage data found. Initializing defaults.');
      const initial = createInitialData();
      saveAppData(initial);
      return initial;
    }

    // Safety checks for schema upgrades
    if (!parsed.policy || !parsed.policy.allowedClosureDays) {
      parsed.policy = createDefaultPolicy(parsed.stations.length || 3);
    }
    if (!parsed.schedules) {
      parsed.schedules = {};
    }

    // Auto-discover latest published schedule if not explicitly tracked
    if (!parsed.latestPublishedWeekId && parsed.schedules) {
      const published = Object.values(parsed.schedules as Record<string, WeekSchedule>)
        .filter((s) => s && s.isPublished && s.isValid)
        .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
      if (published.length > 0) {
        parsed.latestPublishedWeekId = published[0].weekId;
        parsed.lastPublishedAt = published[0].lastModified;
      }
    }

    return parsed as AppDataSchema;
  } catch (err) {
    console.error('Failed to read localStorage:', err);
    return createInitialData();
  }
}

/**
 * Saves data safely to localStorage
 */
export function saveAppData(data: AppDataSchema): boolean {
  try {
    data.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error('Failed to write to localStorage:', err);
    return false;
  }
}

/**
 * Validates an uploaded JSON file before importing.
 */
export function validateImportedData(rawObj: any): { valid: boolean; error?: string; data?: AppDataSchema } {
  if (!rawObj || typeof rawObj !== 'object') {
    return { valid: false, error: 'Imported file does not contain a valid JSON object.' };
  }

  if (!Array.isArray(rawObj.stations)) {
    return { valid: false, error: 'Missing or invalid "stations" array in imported data.' };
  }

  if (!Array.isArray(rawObj.members)) {
    return { valid: false, error: 'Missing or invalid "members" array in imported data.' };
  }

  if (!rawObj.policy || !rawObj.policy.allowedClosureDays) {
    return { valid: false, error: 'Missing closure policy in imported data.' };
  }

  // Critical rule: Each station can have at most MAX_MEMBERS_PER_STATION (3) members
  for (const st of rawObj.stations) {
    const assignedCount = rawObj.members.filter((m: any) => m && m.stationId === st.id).length;
    if (assignedCount > MAX_MEMBERS_PER_STATION) {
      return {
        valid: false,
        error: `Station '${st.name || st.id}' has ${assignedCount} members assigned, which violates the critical rule of at most ${MAX_MEMBERS_PER_STATION} members per station.`,
      };
    }
  }

  const validData: AppDataSchema = {
    version: rawObj.version || CURRENT_SCHEMA_VERSION,
    stations: rawObj.stations,
    members: rawObj.members,
    declaredTotalMembers: Number(rawObj.declaredTotalMembers) || rawObj.members.length,
    policy: rawObj.policy,
    schedules: rawObj.schedules || {},
    currentWeekId: rawObj.currentWeekId || getISOWeekInfo().weekId,
    latestPublishedWeekId: rawObj.latestPublishedWeekId,
    lastPublishedAt: rawObj.lastPublishedAt,
    isWizardCompleted: Boolean(rawObj.isWizardCompleted),
    updatedAt: Date.now(),
  };

  return { valid: true, data: validData };
}
