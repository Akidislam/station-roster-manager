import { describe, it, expect } from 'vitest';
import {
  analyzeFeasibility,
  createDefaultPolicy,
  generateOptimalRoster,
  validateSchedule,
  validateStationCapacities,
  ClosureHistory,
} from '../utils/scheduler';
import { ClosurePolicy, Weekday, WEEKDAYS, MAX_MEMBERS_PER_STATION, Station, Member } from '../types';

describe('Station Roster Manager - Scheduling Engine & Constraint Logic', () => {
  // Test 1: Three stations, each closing exactly twice, with at least one station open every day
  it('1. Three stations: generates a valid roster where each closes exactly twice and >= 1 station open every day', () => {
    const stationIds = ['S1', 'S2', 'S3'];
    const names = { S1: 'Station 1', S2: 'Station 2', S3: 'Station 3' };
    const policy = createDefaultPolicy(3); // minOpen = 1, Thu-Sun allowed

    const feasibility = analyzeFeasibility(3, policy);
    expect(feasibility.isFeasible).toBe(true);

    const result = generateOptimalRoster(stationIds, policy);
    expect(result.success).toBe(true);

    const errors = validateSchedule(stationIds, names, policy, result.assignments);
    expect(errors).toHaveLength(0);

    // Verify each station has exactly 2 closures
    for (const sId of stationIds) {
      const closedDays = WEEKDAYS.filter((d) => result.assignments[d][sId]);
      expect(closedDays.length).toBe(2);
    }

    // Verify at least 1 station open every day
    for (const d of WEEKDAYS) {
      const openCount = stationIds.filter((sId) => !result.assignments[d][sId]).length;
      expect(openCount).toBeGreaterThanOrEqual(1);
    }
  });

  // Test 2: Four stations, each closing exactly twice, with at least two stations open every day
  it('2. Four stations: generates a valid roster where each closes exactly twice and >= 2 stations open every day', () => {
    const stationIds = ['S1', 'S2', 'S3', 'S4'];
    const names = { S1: 'Station 1', S2: 'Station 2', S3: 'Station 3', S4: 'Station 4' };
    const policy = createDefaultPolicy(4); // minOpen = 2, Thu-Sun allowed

    const feasibility = analyzeFeasibility(4, policy);
    expect(feasibility.isFeasible).toBe(true);

    const result = generateOptimalRoster(stationIds, policy);
    expect(result.success).toBe(true);

    const errors = validateSchedule(stationIds, names, policy, result.assignments);
    expect(errors).toHaveLength(0);

    // Verify each station has exactly 2 closures
    for (const sId of stationIds) {
      const closedDays = WEEKDAYS.filter((d) => result.assignments[d][sId]);
      expect(closedDays.length).toBe(2);
    }

    // Verify at least 2 stations open every day
    for (const d of WEEKDAYS) {
      const openCount = stationIds.filter((sId) => !result.assignments[d][sId]).length;
      expect(openCount).toBeGreaterThanOrEqual(2);
    }
  });

  // Test 3: Five stations under the default policy: must report infeasible because only 8 closures possible while 10 required
  it('3. Five stations under default policy: must report infeasible with mathematical proof of 10 required vs 8 capacity', () => {
    const stationIds = ['S1', 'S2', 'S3', 'S4', 'S5'];
    const policy = createDefaultPolicy(5); // minOpen = 3, Thu-Sun allowed (4 days)

    const feasibility = analyzeFeasibility(5, policy);
    expect(feasibility.isFeasible).toBe(false);
    expect(feasibility.proof).toBeDefined();
    expect(feasibility.proof?.totalClosuresRequired).toBe(10);
    expect(feasibility.proof?.maxPossibleClosures).toBe(8);
    expect(feasibility.proof?.deficit).toBe(2);
    expect(feasibility.suggestedPolicies).toBeDefined();
    expect(feasibility.suggestedPolicies!.length).toBeGreaterThan(0);

    // Engine must refuse to return a successful schedule
    const result = generateOptimalRoster(stationIds, policy);
    expect(result.success).toBe(false);
  });

  // Test 4: Five stations under proposed alternative policy: generates valid schedule with >= 3 stations open every day
  it('4. Five stations under proposed alternative policy: generates valid schedule with >= 3 open every day', () => {
    const stationIds = ['S1', 'S2', 'S3', 'S4', 'S5'];
    const names = { S1: 'Station 1', S2: 'Station 2', S3: 'Station 3', S4: 'Station 4', S5: 'Station 5' };
    
    // Alternative policy: Mon, Tue, Thu, Fri, Sat, Sun allowed (Wed prohibited), minOpen = 3, closuresPerStation = 2
    const alternativePolicy: ClosurePolicy = {
      allowedClosureDays: {
        Monday: true,
        Tuesday: true,
        Wednesday: false,
        Thursday: true,
        Friday: true,
        Saturday: true,
        Sunday: true,
      },
      closuresPerStation: 2,
      minOpenStationsPerDay: 3,
    };

    const feasibility = analyzeFeasibility(5, alternativePolicy);
    expect(feasibility.isFeasible).toBe(true);

    const result = generateOptimalRoster(stationIds, alternativePolicy);
    expect(result.success).toBe(true);

    const errors = validateSchedule(stationIds, names, alternativePolicy, result.assignments);
    expect(errors).toHaveLength(0);

    // Each station closes exactly 2 times
    for (const sId of stationIds) {
      const closedDays = WEEKDAYS.filter((d) => result.assignments[d][sId]);
      expect(closedDays.length).toBe(2);
    }

    // At least 3 stations open every day
    for (const d of WEEKDAYS) {
      const openCount = stationIds.filter((sId) => !result.assignments[d][sId]).length;
      expect(openCount).toBeGreaterThanOrEqual(3);
    }

    // Wednesday must have 0 closures (all 5 open)
    const wedClosedCount = stationIds.filter((sId) => result.assignments['Wednesday'][sId]).length;
    expect(wedClosedCount).toBe(0);

    // Verify the canonical example schedule pattern mentioned in prompt also passes validation
    const canonicalExampleGrid: Record<Weekday, Record<string, boolean>> = {
      Monday: { S1: true, S2: true, S3: false, S4: false, S5: false },
      Tuesday: { S1: false, S2: false, S3: true, S4: true, S5: false },
      Wednesday: { S1: false, S2: false, S3: false, S4: false, S5: false },
      Thursday: { S1: true, S2: false, S3: false, S4: false, S5: true },
      Friday: { S1: false, S2: true, S3: true, S4: false, S5: false },
      Saturday: { S1: false, S2: false, S3: false, S4: true, S5: true },
      Sunday: { S1: false, S2: false, S3: false, S4: false, S5: false },
    };
    const canonicalErrors = validateSchedule(stationIds, names, alternativePolicy, canonicalExampleGrid);
    expect(canonicalErrors).toHaveLength(0);
  });

  // Test 5: No closures on prohibited days
  it('5. Strictly rejects closures on prohibited days', () => {
    const stationIds = ['S1', 'S2', 'S3'];
    const names = { S1: 'Station 1', S2: 'Station 2', S3: 'Station 3' };
    const policy = createDefaultPolicy(3); // Mon, Tue, Wed prohibited

    const illegalAssignments: Record<Weekday, Record<string, boolean>> = {
      Monday: { S1: true, S2: false, S3: false }, // ILLEGAL: closed on Monday
      Tuesday: { S1: false, S2: false, S3: false },
      Wednesday: { S1: false, S2: false, S3: false },
      Thursday: { S1: true, S2: false, S3: false },
      Friday: { S1: false, S2: true, S3: false },
      Saturday: { S1: false, S2: true, S3: true },
      Sunday: { S1: false, S2: false, S3: true },
    };

    const errors = validateSchedule(stationIds, names, policy, illegalAssignments);
    expect(errors.some((err) => err.includes('Station 1 is closed on Monday, which is a prohibited closure day'))).toBe(true);
  });

  // Test 6: Invalid manual edits are detected
  it('6. Invalid manual edits are immediately detected with descriptive error messages', () => {
    const stationIds = ['S1', 'S2', 'S3', 'S4'];
    const names = { S1: 'Station 1', S2: 'Station 2', S3: 'Station 3', S4: 'Station 4' };
    const policy = createDefaultPolicy(4); // minOpen = 2, k = 2

    // S1 closed 3 times (invalid), and Thursday has 3 stations closed => only 1 open (violating min 2)
    const invalidAssignments: Record<Weekday, Record<string, boolean>> = {
      Monday: { S1: false, S2: false, S3: false, S4: false },
      Tuesday: { S1: false, S2: false, S3: false, S4: false },
      Wednesday: { S1: false, S2: false, S3: false, S4: false },
      Thursday: { S1: true, S2: true, S3: true, S4: false }, // 3 closed -> 1 open (< 2)
      Friday: { S1: true, S2: false, S3: false, S4: false },
      Saturday: { S1: true, S2: false, S3: false, S4: true }, // S1 has 3 closures!
      Sunday: { S1: false, S2: true, S3: true, S4: true },
    };

    const errors = validateSchedule(stationIds, names, policy, invalidAssignments);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('Station 1 has 3 closure day(s) assigned'))).toBe(true);
    expect(errors.some((e) => e.includes('Thursday has only 1 station(s) open'))).toBe(true);
  });

  // Test 7: Fairness optimization never violates mandatory constraints
  it('7. Fairness optimization rotates days based on history while strictly honoring all constraints', () => {
    const stationIds = ['S1', 'S2', 'S3', 'S4'];
    const names = { S1: 'Station 1', S2: 'Station 2', S3: 'Station 3', S4: 'Station 4' };
    const policy = createDefaultPolicy(4);

    // Mock heavy prior closures on Thursday & Friday for S1
    const history: ClosureHistory = {
      S1: { Thursday: 5, Friday: 5, Saturday: 0, Sunday: 0, Monday: 0, Tuesday: 0, Wednesday: 0 },
      S2: { Thursday: 0, Friday: 0, Saturday: 5, Sunday: 5, Monday: 0, Tuesday: 0, Wednesday: 0 },
      S3: { Thursday: 2, Friday: 2, Saturday: 2, Sunday: 2, Monday: 0, Tuesday: 0, Wednesday: 0 },
      S4: { Thursday: 2, Friday: 2, Saturday: 2, Sunday: 2, Monday: 0, Tuesday: 0, Wednesday: 0 },
    };

    const result = generateOptimalRoster(stationIds, policy, history);
    expect(result.success).toBe(true);

    // Mandatory constraints must still be 100% valid
    const errors = validateSchedule(stationIds, names, policy, result.assignments);
    expect(errors).toHaveLength(0);

    // Station 1 had 5 closures on Thu & Fri, so fairness optimizer should have given S1 Saturday & Sunday off
    expect(result.assignments.Saturday['S1']).toBe(true);
    expect(result.assignments.Sunday['S1']).toBe(true);
  });

  // Test 8: Impossible policies never produce a publishable roster
  it('8. Impossible policies never produce a publishable or valid roster', () => {
    const stationIds = ['S1', 'S2', 'S3'];
    // Impossible policy: requires 5 closures per station in 4 eligible days
    const impossiblePolicy: ClosurePolicy = {
      allowedClosureDays: {
        Monday: false,
        Tuesday: false,
        Wednesday: false,
        Thursday: true,
        Friday: true,
        Saturday: true,
        Sunday: true,
      },
      closuresPerStation: 5, // Impossible (k > eligible days)
      minOpenStationsPerDay: 1,
    };

    const feasibility = analyzeFeasibility(3, impossiblePolicy);
    expect(feasibility.isFeasible).toBe(false);

    const result = generateOptimalRoster(stationIds, impossiblePolicy);
    expect(result.success).toBe(false);
  });

  // Test 9: Critical station staffing rule: each station can have a maximum of 3 members (0, 1, 2, or 3)
  it('9. Critical station staffing rule: allows 0, 1, 2, or 3 members; strictly rejects a fourth member', () => {
    expect(MAX_MEMBERS_PER_STATION).toBe(3);

    const stations: Station[] = [
      { id: 'S1', name: 'Dhaka Station', createdAt: 1 },
      { id: 'S2', name: 'Chattogram Station', createdAt: 2 },
      { id: 'S3', name: 'Sylhet Station', createdAt: 3 },
    ];

    // Valid staffing: S1 has 3 members, S2 has 2 members, S3 has 0 members
    const validMembers: Member[] = [
      { id: 'm1', name: 'Kamruzzaman', stationId: 'S1', createdAt: 1 },
      { id: 'm2', name: 'Russell', stationId: 'S1', createdAt: 2 },
      { id: 'm3', name: 'Ayman', stationId: 'S1', createdAt: 3 },
      { id: 'm4', name: 'Akib', stationId: 'S2', createdAt: 4 },
      { id: 'm5', name: 'Sunny', stationId: 'S2', createdAt: 5 },
      // S3 has 0 members
    ];

    const validErrors = validateStationCapacities(stations, validMembers);
    expect(validErrors).toHaveLength(0);

    // Invalid staffing: attempting to assign a fourth member to S1
    const invalidMembers: Member[] = [
      ...validMembers,
      { id: 'm6', name: 'Fourth Member Prohibited', stationId: 'S1', createdAt: 6 },
    ];

    const invalidErrors = validateStationCapacities(stations, invalidMembers);
    expect(invalidErrors.length).toBeGreaterThan(0);
    expect(invalidErrors[0]).toContain("exceeds the maximum limit of 3 members");
  });
});

