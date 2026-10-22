import { describe, it, expect } from 'vitest';
import {
  getDaysInMonth,
  isLeapYear,
  getWeekdayName,
  formatMonthDayDate,
  generateMonthlyRoster,
  MONTH_NAMES,
} from '../utils/monthlyScheduler';
import {
  exportMonthlyRosterToCSV,
  generateMonthlyExcelWorkbook,
  sanitizeCsvField,
} from '../utils/monthlyExport';
import {
  createDefaultPolicy,
  analyzeFeasibility,
} from '../utils/scheduler';
import {
  ClosurePolicy,
  Member,
  Station,
  MAX_MEMBERS_PER_STATION,
} from '../types';

describe('Monthly Roster Generation & Spreadsheet Export Engine', () => {
  // Test 10: Selected month generates exact number of days
  it('10. Exact calendar day counts generated for any month (e.g. October 31, April 30, February 28/29)', () => {
    expect(getDaysInMonth(2026, 10)).toBe(31); // October
    expect(getDaysInMonth(2026, 4)).toBe(30);  // April
    expect(getDaysInMonth(2026, 6)).toBe(30);  // June
    expect(getDaysInMonth(2026, 7)).toBe(31);  // July
    expect(getDaysInMonth(2026, 8)).toBe(31);  // August
    expect(getDaysInMonth(2026, 12)).toBe(31); // December
    expect(getDaysInMonth(2026, 1)).toBe(31);  // January

    const stations: Station[] = [
      { id: 'S1', name: 'Dhaka Station', createdAt: 1 },
      { id: 'S2', name: 'Chattogram Station', createdAt: 2 },
      { id: 'S3', name: 'Sylhet Station', createdAt: 3 },
    ];
    const members: Member[] = [
      { id: 'm1', name: 'Kamruzzaman', stationId: 'S1', createdAt: 1 },
    ];
    const policy = createDefaultPolicy(3);

    // October 2026 roster must have exactly 31 days
    const octRoster = generateMonthlyRoster(2026, 10, stations, members, policy);
    expect(octRoster.days).toHaveLength(31);
    expect(octRoster.totalDays).toBe(31);
    expect(octRoster.monthName).toBe('October');
    expect(octRoster.days[0].dayNumber).toBe(1);
    expect(octRoster.days[30].dayNumber).toBe(31);

    // April 2026 roster must have exactly 30 days
    const aprRoster = generateMonthlyRoster(2026, 4, stations, members, policy);
    expect(aprRoster.days).toHaveLength(30);
    expect(aprRoster.totalDays).toBe(30);
    expect(aprRoster.monthName).toBe('April');
  });

  // Test 11: Leap year February handling
  it('11. Leap year February specifically handled: 2024 has 29 days, 2025/2026 have 28 days', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2025)).toBe(false);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(2028)).toBe(true);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);

    expect(getDaysInMonth(2024, 2)).toBe(29);
    expect(getDaysInMonth(2025, 2)).toBe(28);
    expect(getDaysInMonth(2026, 2)).toBe(28);

    const stations: Station[] = [
      { id: 'S1', name: 'Station 1', createdAt: 1 },
      { id: 'S2', name: 'Station 2', createdAt: 2 },
      { id: 'S3', name: 'Station 3', createdAt: 3 },
    ];
    const policy = createDefaultPolicy(3);

    // Leap year Feb 2024
    const leapRoster = generateMonthlyRoster(2024, 2, stations, [], policy);
    expect(leapRoster.days).toHaveLength(29);
    expect(leapRoster.days[28].dayNumber).toBe(29);
    expect(leapRoster.days[28].formattedDate).toBe('29-Feb-2024');

    // Non-leap year Feb 2025
    const nonLeapRoster = generateMonthlyRoster(2025, 2, stations, [], policy);
    expect(nonLeapRoster.days).toHaveLength(28);
    expect(nonLeapRoster.days[27].dayNumber).toBe(28);
    expect(nonLeapRoster.days[27].formattedDate).toBe('28-Feb-2025');
  });

  // Test 12: Weekday labels match calendar dates
  it('12. Weekday labels match actual calendar dates for the selected month/year', () => {
    // 2026-10-01 is a Thursday
    const oct1Date = new Date(2026, 9, 1);
    expect(getWeekdayName(oct1Date)).toBe('Thursday');

    // 2026-10-02 is Friday
    const oct2Date = new Date(2026, 9, 2);
    expect(getWeekdayName(oct2Date)).toBe('Friday');

    // 2026-10-03 is Saturday (weekend)
    const oct3Date = new Date(2026, 9, 3);
    expect(getWeekdayName(oct3Date)).toBe('Saturday');

    // 2026-10-04 is Sunday (weekend)
    const oct4Date = new Date(2026, 9, 4);
    expect(getWeekdayName(oct4Date)).toBe('Sunday');

    // 2024-02-29 is a Thursday
    const leapFeb29 = new Date(2024, 1, 29);
    expect(getWeekdayName(leapFeb29)).toBe('Thursday');

    const stations: Station[] = [
      { id: 'S1', name: 'Station A', createdAt: 1 },
      { id: 'S2', name: 'Station B', createdAt: 2 },
      { id: 'S3', name: 'Station C', createdAt: 3 },
    ];
    const policy = createDefaultPolicy(3);
    const roster = generateMonthlyRoster(2026, 10, stations, [], policy);

    expect(roster.days[0].weekday).toBe('Thursday');
    expect(roster.days[0].isWeekend).toBe(false);
    expect(roster.days[1].weekday).toBe('Friday');
    expect(roster.days[1].isWeekend).toBe(false);
    expect(roster.days[2].weekday).toBe('Saturday');
    expect(roster.days[2].isWeekend).toBe(true);
    expect(roster.days[3].weekday).toBe('Sunday');
    expect(roster.days[3].isWeekend).toBe(true);
  });

  // Test 13: Weekly rules applied correctly across month boundaries
  it('13. Weekly rules applied correctly across calendar dates (prohibited days honored, minimum coverage met)', () => {
    const stations: Station[] = [
      { id: 'S1', name: 'Dhaka', createdAt: 1 },
      { id: 'S2', name: 'Chattogram', createdAt: 2 },
      { id: 'S3', name: 'Sylhet', createdAt: 3 },
      { id: 'S4', name: 'Rajshahi', createdAt: 4 },
    ];
    const policy = createDefaultPolicy(4); // minOpen = 2, closuresPerStation = 2, Thu-Sun allowed

    const roster = generateMonthlyRoster(2026, 10, stations, [], policy);
    expect(roster.isFeasible).toBe(true);

    for (const day of roster.days) {
      // Mon, Tue, Wed are prohibited closure days -> 0 closures allowed, all stations must be open
      if (day.weekday === 'Monday' || day.weekday === 'Tuesday' || day.weekday === 'Wednesday') {
        for (const st of stations) {
          expect(day.stations[st.id].isClosed).toBe(false);
        }
      }

      // Minimum open stations per day must always be met
      const openCount = stations.filter((st) => !day.stations[st.id].isClosed).length;
      expect(openCount).toBeGreaterThanOrEqual(policy.minOpenStationsPerDay);
    }
  });

  // Test 14: Infeasible policies reject monthly roster generation with mathematical proof
  it('14. Infeasible policies (e.g. 5 stations default policy) reject monthly roster generation and block export', () => {
    const stations: Station[] = [
      { id: 'S1', name: 'Station 1', createdAt: 1 },
      { id: 'S2', name: 'Station 2', createdAt: 2 },
      { id: 'S3', name: 'Station 3', createdAt: 3 },
      { id: 'S4', name: 'Station 4', createdAt: 4 },
      { id: 'S5', name: 'Station 5', createdAt: 5 },
    ];
    const impossiblePolicy = createDefaultPolicy(5); // 10 required closures vs 8 capacity

    const feasibility = analyzeFeasibility(5, impossiblePolicy);
    expect(feasibility.isFeasible).toBe(false);

    const roster = generateMonthlyRoster(2026, 10, stations, [], impossiblePolicy);
    expect(roster.isFeasible).toBe(false);
    expect(roster.days).toHaveLength(0);
    expect(roster.feasibilityReason).toBeDefined();
    expect(roster.feasibilityReason).toContain('Slot Deficit: 2 missing closure slot(s)');
    expect(roster.feasibilityReason).toContain('Pigeonhole Principle');
  });

  // Test 15: Stations with 0, 1, 2, or 3 members export properly without inventing members
  it('15. Stations with varying member counts (0, 1, 2, or 3) export accurately without cross-transferring or inventing staff', () => {
    const stations: Station[] = [
      { id: 'S1', name: 'Dhaka Station', workingHours: '08:00 - 17:00', breakTime: '13:00 - 14:00', createdAt: 1 },
      { id: 'S2', name: 'Chattogram Station', workingHours: '09:00 - 18:00', breakTime: '13:30 - 14:30', createdAt: 2 },
      { id: 'S3', name: 'Sylhet Station', workingHours: '08:00 - 17:00', breakTime: '13:00 - 14:00', createdAt: 3 },
    ];

    // S1 has 3 members (maximum capacity), S2 has 1 member, S3 has 0 members
    const members: Member[] = [
      { id: 'm1', name: 'Kamruzzaman', stationId: 'S1', createdAt: 1 },
      { id: 'm2', name: 'Russell', stationId: 'S1', createdAt: 2 },
      { id: 'm3', name: 'Ayman', stationId: 'S1', createdAt: 3 },
      { id: 'm4', name: 'Akib', stationId: 'S2', createdAt: 4 },
    ];

    const policy = createDefaultPolicy(3);
    const roster = generateMonthlyRoster(2026, 10, stations, members, policy);
    expect(roster.isFeasible).toBe(true);

    for (const day of roster.days) {
      // S1 must always have precisely Kamruzzaman, Russell, and Ayman
      expect(day.stations['S1'].assignedMembers).toHaveLength(3);
      expect(day.stations['S1'].assignedMembers.map((m) => m.name)).toEqual(['Kamruzzaman', 'Russell', 'Ayman']);

      // S2 must always have precisely Akib
      expect(day.stations['S2'].assignedMembers).toHaveLength(1);
      expect(day.stations['S2'].assignedMembers[0].name).toBe('Akib');

      // S3 has 0 members, must remain empty, never invented
      expect(day.stations['S3'].assignedMembers).toHaveLength(0);
    }
  });

  // Test 16: Excel export generates non-empty buffer with correct worksheets & styling
  it('16. Excel export generates a valid multi-column workbook with header metadata and frozen panes', async () => {
    const stations: Station[] = [
      { id: 'S1', name: 'Dhaka Station', workingHours: '08:00 - 17:00', breakTime: '13:00 - 14:00', createdAt: 1 },
      { id: 'S2', name: 'Chattogram Station', workingHours: '08:30 - 17:30', breakTime: '13:00 - 14:00', createdAt: 2 },
      { id: 'S3', name: 'Sylhet Station', workingHours: '08:00 - 17:00', breakTime: '13:00 - 14:00', createdAt: 3 },
    ];
    const members: Member[] = [
      { id: 'm1', name: 'Kamruzzaman', stationId: 'S1', createdAt: 1 },
      { id: 'm2', name: 'Russell', stationId: 'S2', createdAt: 2 },
    ];
    const policy = createDefaultPolicy(3);
    const roster = generateMonthlyRoster(2026, 10, stations, members, policy);

    const workbook = await generateMonthlyExcelWorkbook(roster);
    expect(workbook).toBeDefined();

    const sheet = workbook.getWorksheet('October 2026');
    expect(sheet).toBeDefined();

    // Check frozen panes: xSplit 2, ySplit 5
    const firstView = sheet?.views?.[0] as any;
    expect(firstView?.xSplit).toBe(2);
    expect(firstView?.ySplit).toBe(5);

    // Title banner row 1
    const titleCell = sheet?.getCell(1, 1);
    expect(titleCell?.value).toContain('MONTHLY STATION OPERATIONAL ROSTER');

    // Date and Day headers
    const dateHeader = sheet?.getCell(3, 1);
    expect(dateHeader?.value).toBe('DATE');

    // Stations headers
    const s1Header = sheet?.getCell(3, 3);
    expect(s1Header?.value).toBe('DHAKA STATION');

    // Buffer creation check
    const buffer = await workbook.xlsx.writeBuffer();
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });

  // Test 17: CSV export has identical assignments, proper escaping, UTF-8 BOM, and formula injection protection
  it('17. CSV export preserves UTF-8 Unicode characters, provides BOM, and sanitizes formula injections', () => {
    // Formula injection sanitizer test
    expect(sanitizeCsvField('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    expect(sanitizeCsvField('+cmd|/C calc')).toBe("'+cmd|/C calc");
    expect(sanitizeCsvField('-1+1')).toBe("'-1+1");
    expect(sanitizeCsvField('@alert')).toBe("'@alert");
    expect(sanitizeCsvField('Regular Name')).toBe('Regular Name');
    expect(sanitizeCsvField('Name, With Comma')).toBe('"Name, With Comma"');

    const stations: Station[] = [
      { id: 'S1', name: 'Dhaka Central', createdAt: 1 },
      { id: 'S2', name: 'Chattogram Port', createdAt: 2 },
      { id: 'S3', name: 'Sylhet Metro', createdAt: 3 },
    ];

    // Unicode Bangla and international characters
    const members: Member[] = [
      { id: 'm1', name: 'কামরুজ্জামান', stationId: 'S1', createdAt: 1 },
      { id: 'm2', name: 'Russell O’Connor', stationId: 'S2', createdAt: 2 },
      { id: 'm3', name: '=HYPERLINK("malicious")', stationId: 'S3', createdAt: 3 }, // Injection attempt
    ];

    const policy = createDefaultPolicy(3);
    const roster = generateMonthlyRoster(2026, 10, stations, members, policy);

    const csv = exportMonthlyRosterToCSV(roster);

    // Byte Order Mark (\uFEFF) at the start
    expect(csv.startsWith('\uFEFF')).toBe(true);

    // Unicode characters must be present intact
    expect(csv).toContain('কামরুজ্জামান');
    expect(csv).toContain('Russell O’Connor');

    // Formula injection must be neutralized with leading single quote
    expect(csv).toContain("'=HYPERLINK");

    // All stations and calendar days represented
    expect(csv).toContain('Dhaka Central');
    expect(csv).toContain('Chattogram Port');
    expect(csv).toContain('Sylhet Metro');
    expect(csv).toContain('31-Oct-2026');
  });
});
