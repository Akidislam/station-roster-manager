import {
  ClosurePolicy,
  FeasibilityResult,
  SuggestedPolicy,
  Weekday,
  WEEKDAYS,
  MAX_MEMBERS_PER_STATION,
  Member,
  Station,
} from '../types';

/**
 * Validates that no station exceeds the critical limit of 3 members.
 * A station may have 0, 1, 2, or 3 members. A 4th member is strictly prohibited.
 */
export function validateStationCapacities(stations: Station[], members: Member[]): string[] {
  const errors: string[] = [];
  for (const st of stations) {
    const assignedCount = members.filter((m) => m.stationId === st.id).length;
    if (assignedCount > MAX_MEMBERS_PER_STATION) {
      errors.push(
        `Critical staffing rule violated: Station '${st.name}' has ${assignedCount} members assigned, which exceeds the maximum limit of ${MAX_MEMBERS_PER_STATION} members.`
      );
    }
  }
  return errors;
}

/**
 * Calculates the default recommended minimum open stations for a given station count.
 * 3 stations -> at least 1 open
 * 4 stations -> at least 2 open
 * 5 stations -> at least 3 open
 * Others -> max(1, count - 2)
 */
export function getDefaultMinOpenStations(stationCount: number): number {
  if (stationCount <= 2) return 1;
  if (stationCount === 3) return 1;
  if (stationCount === 4) return 2;
  if (stationCount === 5) return 3;
  return Math.max(1, stationCount - 2);
}

/**
 * Default weekly closure policy:
 * - Mon, Tue, Wed: No closures allowed
 * - Thu, Fri, Sat, Sun: Closures allowed
 * - Each station closed exactly 2 days per week
 */
export function createDefaultPolicy(stationCount: number): ClosurePolicy {
  return {
    allowedClosureDays: {
      Monday: false,
      Tuesday: false,
      Wednesday: false,
      Thursday: true,
      Friday: true,
      Saturday: true,
      Sunday: true,
    },
    closuresPerStation: 2,
    minOpenStationsPerDay: getDefaultMinOpenStations(stationCount),
  };
}

/**
 * Mathematically validates whether a policy can ever produce a valid schedule.
 * Returns a formal proof if infeasible.
 */
export function analyzeFeasibility(
  stationCount: number,
  policy: ClosurePolicy
): FeasibilityResult {
  if (stationCount <= 0) {
    return {
      isFeasible: false,
      reason: 'At least one station is required.',
    };
  }

  const k = policy.closuresPerStation;
  const eligibleDays = WEEKDAYS.filter((day) => policy.allowedClosureDays[day]);
  const numEligibleDays = eligibleDays.length;
  const minOpen = policy.minOpenStationsPerDay;

  // Station must not close more days than there are eligible closure days
  if (k > numEligibleDays) {
    return {
      isFeasible: false,
      reason: `Each station requires ${k} closure days, but only ${numEligibleDays} day(s) allow closures. Stations cannot close multiple times on the same date.`,
      proof: {
        totalStations: stationCount,
        closuresRequiredPerStation: k,
        totalClosuresRequired: stationCount * k,
        eligibleDaysCount: numEligibleDays,
        minOpenStations: minOpen,
        maxClosuresPerDay: Math.max(0, stationCount - minOpen),
        maxPossibleClosures: numEligibleDays * Math.max(0, stationCount - minOpen),
        deficit: stationCount * k - numEligibleDays * Math.max(0, stationCount - minOpen),
      },
      suggestedPolicies: generateSuggestions(stationCount, policy),
    };
  }

  // Max closures allowed on any single day = stationCount - minOpen
  const maxClosuresPerDay = Math.max(0, stationCount - minOpen);
  if (minOpen > stationCount) {
    return {
      isFeasible: false,
      reason: `Minimum required open stations (${minOpen}) exceeds total station count (${stationCount}).`,
      proof: {
        totalStations: stationCount,
        closuresRequiredPerStation: k,
        totalClosuresRequired: stationCount * k,
        eligibleDaysCount: numEligibleDays,
        minOpenStations: minOpen,
        maxClosuresPerDay: 0,
        maxPossibleClosures: 0,
        deficit: stationCount * k,
      },
      suggestedPolicies: generateSuggestions(stationCount, policy),
    };
  }

  // Capacity bound: Total closures required vs. Maximum possible closures
  const totalClosuresRequired = stationCount * k;
  const maxPossibleClosures = numEligibleDays * maxClosuresPerDay;

  if (maxPossibleClosures < totalClosuresRequired) {
    const deficit = totalClosuresRequired - maxPossibleClosures;
    const proofText =
      `Mathematical Infeasibility Proof:\n` +
      `• Total stations (S): ${stationCount}\n` +
      `• Required closures per station (k): ${k} days/week\n` +
      `• Total weekly closure slots required (S × k): ${totalClosuresRequired}\n` +
      `• Days allowing closures: ${numEligibleDays} (${eligibleDays.join(', ')})\n` +
      `• Minimum open stations per day: ${minOpen}\n` +
      `• Maximum closures permitted per day (S - minOpen): ${maxClosuresPerDay}\n` +
      `• Maximum possible weekly closures (${numEligibleDays} days × ${maxClosuresPerDay} closures/day): ${maxPossibleClosures}\n` +
      `• Slot Deficit: ${deficit} missing closure slot(s).\n` +
      `By the Generalized Pigeonhole Principle, allocating ${totalClosuresRequired} closures into a maximum capacity of ${maxPossibleClosures} is strictly impossible.`;

    return {
      isFeasible: false,
      reason: proofText,
      proof: {
        totalStations: stationCount,
        closuresRequiredPerStation: k,
        totalClosuresRequired,
        eligibleDaysCount: numEligibleDays,
        minOpenStations: minOpen,
        maxClosuresPerDay,
        maxPossibleClosures,
        deficit,
      },
      suggestedPolicies: generateSuggestions(stationCount, policy),
    };
  }

  return {
    isFeasible: true,
    reason: `Policy is mathematically feasible: ${totalClosuresRequired} closure slots required with a weekly capacity of ${maxPossibleClosures} slots across ${numEligibleDays} active closure days.`,
    proof: {
      totalStations: stationCount,
      closuresRequiredPerStation: k,
      totalClosuresRequired,
      eligibleDaysCount: numEligibleDays,
      minOpenStations: minOpen,
      maxClosuresPerDay,
      maxPossibleClosures,
      deficit: 0,
    },
  };
}

/**
 * Generates feasible policy alternatives when the current policy is mathematically infeasible.
 */
export function generateSuggestions(
  stationCount: number,
  currentPolicy: ClosurePolicy
): SuggestedPolicy[] {
  const suggestions: SuggestedPolicy[] = [];
  const k = currentPolicy.closuresPerStation;
  const minOpen = currentPolicy.minOpenStationsPerDay;
  const maxClosuresPerDay = Math.max(0, stationCount - minOpen);
  const totalRequired = stationCount * k;

  // Specific canonical suggestion for 5 stations:
  // Allow Monday & Tuesday, keep Wednesday prohibited (6 eligible days * 2 = 12 capacity >= 10)
  if (stationCount === 5 && minOpen === 3 && k === 2) {
    const monTuePolicyDays: Record<Weekday, boolean> = {
      Monday: true,
      Tuesday: true,
      Wednesday: false,
      Thursday: true,
      Friday: true,
      Saturday: true,
      Sunday: true,
    };
    suggestions.push({
      id: 'five-station-mon-tue',
      title: 'Allow Monday & Tuesday Closures (Preserve Wednesday Prohibited)',
      description:
        'Allows closures on Monday, Tuesday, Thursday, Friday, Saturday, and Sunday (6 days total). Wednesday remains strictly protected with all stations open. Provides 12 closure capacity against 10 required.',
      allowedClosureDays: monTuePolicyDays,
      minOpenStationsPerDay: 3,
      closuresPerStation: 2,
      maxCapacity: 6 * 2,
      requiredCapacity: 10,
    });

    const monOnlyPolicyDays: Record<Weekday, boolean> = {
      Monday: true,
      Tuesday: false,
      Wednesday: false,
      Thursday: true,
      Friday: true,
      Saturday: true,
      Sunday: true,
    };
    suggestions.push({
      id: 'five-station-mon-only',
      title: 'Allow Monday Closures Only (Minimal Change: 5 Days)',
      description:
        'Adds only Monday to the closure window (5 days total). Capacity exactly matches demand: 5 days × 2 closures/day = 10 slots. Preserves Tue & Wed with full staffing.',
      allowedClosureDays: monOnlyPolicyDays,
      minOpenStationsPerDay: 3,
      closuresPerStation: 2,
      maxCapacity: 5 * 2,
      requiredCapacity: 10,
    });
  }

  // General Suggestion 1: Unlock additional days progressively (e.g. Wednesday, Tuesday, Monday)
  if (maxClosuresPerDay > 0) {
    const daysNeeded = Math.ceil(totalRequired / maxClosuresPerDay);
    if (daysNeeded <= 7) {
      // Find days currently closed and enable them in order of Mon, Tue, Wed
      const newDays = { ...currentPolicy.allowedClosureDays };
      const priorityToEnable: Weekday[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      for (const d of priorityToEnable) {
        newDays[d] = true;
        const count = WEEKDAYS.filter((day) => newDays[day]).length;
        if (count >= daysNeeded && count * maxClosuresPerDay >= totalRequired) {
          break;
        }
      }
      suggestions.push({
        id: 'expand-days',
        title: `Enable Closures on Additional Weekdays (${daysNeeded} days needed)`,
        description: `Unlocks sufficient weekdays to achieve ${daysNeeded * maxClosuresPerDay} capacity while keeping daily operating coverage at ${minOpen} open stations.`,
        allowedClosureDays: newDays,
        minOpenStationsPerDay: minOpen,
        closuresPerStation: k,
        maxCapacity: WEEKDAYS.filter((d) => newDays[d]).length * maxClosuresPerDay,
        requiredCapacity: totalRequired,
      });
    }
  }

  // General Suggestion 2: Adjust minimum open stations if stationCount permits
  if (minOpen > 1) {
    const adjustedMinOpen = minOpen - 1;
    const adjustedMaxClosures = stationCount - adjustedMinOpen;
    const currentEligibleCount = WEEKDAYS.filter((d) => currentPolicy.allowedClosureDays[d]).length;
    const adjustedCapacity = currentEligibleCount * adjustedMaxClosures;

    if (adjustedCapacity >= totalRequired) {
      suggestions.push({
        id: 'adjust-min-open',
        title: `Adjust Minimum Open Stations to ${adjustedMinOpen}`,
        description: `Allows up to ${adjustedMaxClosures} stations to close per day during existing closure days, yielding ${adjustedCapacity} total closure slots without adding extra weekdays.`,
        allowedClosureDays: { ...currentPolicy.allowedClosureDays },
        minOpenStationsPerDay: adjustedMinOpen,
        closuresPerStation: k,
        maxCapacity: adjustedCapacity,
        requiredCapacity: totalRequired,
      });
    }
  }

  // General Suggestion 3: Reduce closures per station from 2 to 1 if user wants restricted days
  if (k > 1) {
    const reducedClosures = k - 1;
    const reducedTotalRequired = stationCount * reducedClosures;
    const currentEligibleCount = WEEKDAYS.filter((d) => currentPolicy.allowedClosureDays[d]).length;
    if (currentEligibleCount * maxClosuresPerDay >= reducedTotalRequired) {
      suggestions.push({
        id: 'reduce-closure-requirement',
        title: `Reduce Closure Days per Station to ${reducedClosures} Day/Week`,
        description: `Lowers total required closure slots to ${reducedTotalRequired}, fitting comfortably within the current ${currentEligibleCount * maxClosuresPerDay} weekly capacity.`,
        allowedClosureDays: { ...currentPolicy.allowedClosureDays },
        minOpenStationsPerDay: minOpen,
        closuresPerStation: reducedClosures,
        maxCapacity: currentEligibleCount * maxClosuresPerDay,
        requiredCapacity: reducedTotalRequired,
      });
    }
  }

  return suggestions;
}

/**
 * Validates a week's schedule against all mandatory constraints.
 * Returns an array of error messages. If empty, the schedule is 100% valid.
 */
export function validateSchedule(
  stationIds: string[],
  stationNames: Record<string, string>,
  policy: ClosurePolicy,
  assignments: Record<Weekday, Record<string, boolean>>
): string[] {
  const errors: string[] = [];
  const k = policy.closuresPerStation;
  const minOpen = policy.minOpenStationsPerDay;

  // 1. Prohibited days check: No station may be closed on prohibited days
  for (const day of WEEKDAYS) {
    const isDayAllowed = policy.allowedClosureDays[day];
    for (const sId of stationIds) {
      const isClosed = assignments[day]?.[sId] === true;
      if (!isDayAllowed && isClosed) {
        const sName = stationNames[sId] || `Station ${sId}`;
        errors.push(
          `${sName} is closed on ${day}, which is a prohibited closure day under current policy.`
        );
      }
    }
  }

  // 2. Closure count check per station: Every station must close exactly k times per week
  for (const sId of stationIds) {
    let closedDaysCount = 0;
    for (const day of WEEKDAYS) {
      if (assignments[day]?.[sId] === true) {
        closedDaysCount++;
      }
    }
    const sName = stationNames[sId] || `Station ${sId}`;
    if (closedDaysCount !== k) {
      errors.push(
        `${sName} has ${closedDaysCount} closure day(s) assigned (must be exactly ${k}).`
      );
    }
  }

  // 3. Minimum open stations check for every day
  for (const day of WEEKDAYS) {
    let openCount = 0;
    let closedCount = 0;
    for (const sId of stationIds) {
      if (assignments[day]?.[sId] === true) {
        closedCount++;
      } else {
        openCount++;
      }
    }

    if (openCount < minOpen) {
      errors.push(
        `${day} has only ${openCount} station(s) open (${closedCount} closed), violating the minimum requirement of ${minOpen} open station(s).`
      );
    }
  }

  return errors;
}

/**
 * Historical record of closure frequency for fairness calculation
 * history[stationId][day] = count of times closed on this weekday in previous weeks
 */
export type ClosureHistory = Record<string, Record<Weekday, number>>;

/**
 * Computes combinations of size k from an array of elements.
 */
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [head, ...tail] = arr;
  const withHead = combinations(tail, k - 1).map((c) => [head, ...c]);
  const withoutHead = combinations(tail, k);
  return [...withHead, ...withoutHead];
}

/**
 * Deterministic constraint-based scheduling engine with backtracking and fairness optimization.
 */
export function generateOptimalRoster(
  stationIds: string[],
  policy: ClosurePolicy,
  history: ClosureHistory = {}
): {
  success: boolean;
  assignments: Record<Weekday, Record<string, boolean>>;
  fairnessScore: number;
  message: string;
} {
  const S = stationIds.length;
  const k = policy.closuresPerStation;
  const minOpen = policy.minOpenStationsPerDay;
  const maxClosuresPerDay = Math.max(0, S - minOpen);

  // Initialize empty grid
  const createEmptyAssignments = (): Record<Weekday, Record<string, boolean>> => {
    const grid: Record<Weekday, Record<string, boolean>> = {
      Monday: {},
      Tuesday: {},
      Wednesday: {},
      Thursday: {},
      Friday: {},
      Saturday: {},
      Sunday: {},
    };
    for (const day of WEEKDAYS) {
      for (const sId of stationIds) {
        grid[day][sId] = false;
      }
    }
    return grid;
  };

  if (S === 0) {
    return {
      success: false,
      assignments: createEmptyAssignments(),
      fairnessScore: 0,
      message: 'No stations provided.',
    };
  }

  // Pre-check mathematical feasibility
  const feasibility = analyzeFeasibility(S, policy);
  if (!feasibility.isFeasible) {
    return {
      success: false,
      assignments: createEmptyAssignments(),
      fairnessScore: 0,
      message: feasibility.reason,
    };
  }

  const eligibleDays = WEEKDAYS.filter((d) => policy.allowedClosureDays[d]);

  // All valid day-pairs (or k-tuples) for a station
  const stationDayOptions = combinations(eligibleDays, k);

  if (stationDayOptions.length === 0) {
    return {
      success: false,
      assignments: createEmptyAssignments(),
      fairnessScore: 0,
      message: `Cannot choose ${k} closure days from available days.`,
    };
  }

  // Fairness cost evaluator for choosing a day-pair for a station
  // Lower score = higher fairness (prefers days the station has rarely had off)
  const getChoiceFairnessCost = (stationId: string, days: Weekday[]): number => {
    const stationHist = history[stationId] || ({} as Record<Weekday, number>);
    let cost = 0;
    for (const d of days) {
      const pastCount = stationHist[d] || 0;
      cost += pastCount * 10;
    }
    return cost;
  };

  // Sort station day options by fairness cost for each station
  const sortedOptionsByStation: Record<string, { days: Weekday[]; cost: number }[]> = {};
  for (const sId of stationIds) {
    const opts = stationDayOptions.map((days) => ({
      days,
      cost: getChoiceFairnessCost(sId, days),
    }));
    // Sort deterministically: cost ascending, then day names
    opts.sort((a, b) => {
      if (a.cost !== b.cost) return a.cost - b.cost;
      return a.days.join(',').localeCompare(b.days.join(','));
    });
    sortedOptionsByStation[sId] = opts;
  }

  // Backtracking solver
  const dailyCounts: Record<Weekday, number> = {
    Monday: 0,
    Tuesday: 0,
    Wednesday: 0,
    Thursday: 0,
    Friday: 0,
    Saturday: 0,
    Sunday: 0,
  };

  const currentSelection: Record<string, Weekday[]> = {};
  let bestSolution: Record<string, Weekday[]> | null = null;
  let bestSolutionCost = Infinity;

  // Maximum search iterations to prevent runaway in huge state spaces, though S <= 10
  let iterations = 0;
  const MAX_ITERATIONS = 50000;

  function solve(stationIndex: number, currentCost: number): boolean {
    iterations++;
    if (iterations > MAX_ITERATIONS) {
      return false;
    }

    if (stationIndex === S) {
      // Reached complete valid assignment
      if (currentCost < bestSolutionCost) {
        bestSolutionCost = currentCost;
        bestSolution = { ...currentSelection };
        // If cost is 0 (optimal virgin rotation), we can stop early
        if (currentCost === 0) return true;
      }
      return false; // Keep searching for potentially fairer solutions
    }

    const sId = stationIds[stationIndex];
    const remainingStations = S - stationIndex;
    const remainingClosuresNeeded = remainingStations * k;

    // Prune: calculate remaining daily capacity across eligible days
    let remainingCapacity = 0;
    for (const d of eligibleDays) {
      remainingCapacity += maxClosuresPerDay - dailyCounts[d];
    }
    if (remainingCapacity < remainingClosuresNeeded) {
      return false; // Prune branch: not enough capacity left
    }

    const options = sortedOptionsByStation[sId];

    for (const opt of options) {
      // Check if this option violates daily capacity
      let canChoose = true;
      for (const d of opt.days) {
        if (dailyCounts[d] + 1 > maxClosuresPerDay) {
          canChoose = false;
          break;
        }
      }

      if (!canChoose) continue;

      // Make choice
      for (const d of opt.days) {
        dailyCounts[d]++;
      }
      currentSelection[sId] = opt.days;

      const shouldStop = solve(stationIndex + 1, currentCost + opt.cost);

      // Backtrack
      for (const d of opt.days) {
        dailyCounts[d]--;
      }
      delete currentSelection[sId];

      if (shouldStop && bestSolutionCost === 0) return true;
    }

    return false;
  }

  solve(0, 0);

  if (!bestSolution) {
    return {
      success: false,
      assignments: createEmptyAssignments(),
      fairnessScore: 0,
      message:
        'No valid schedule could satisfy all constraints simultaneously under current parameters.',
    };
  }

  // Convert bestSolution to assignments map
  const finalAssignments = createEmptyAssignments();
  const solutionRecord = bestSolution as Record<string, Weekday[]>;
  for (const sId of stationIds) {
    const daysOff: Weekday[] = solutionRecord[sId] || [];
    for (const d of daysOff) {
      finalAssignments[d][sId] = true;
    }
  }

  // Calculate fairness index (100 = perfectly balanced, lower = more skew)
  const fairnessScore = Math.max(0, Math.round(100 - bestSolutionCost * 2));

  return {
    success: true,
    assignments: finalAssignments,
    fairnessScore,
    message: 'Optimal roster generated successfully satisfying all constraints.',
  };
}

/**
 * Calculates current coverage metrics for a given day in the assignments.
 */
export function getDailyCoverage(
  day: Weekday,
  stationIds: string[],
  assignments: Record<Weekday, Record<string, boolean>>
): {
  totalStations: number;
  openCount: number;
  closedCount: number;
  openStationIds: string[];
  closedStationIds: string[];
} {
  const openStationIds: string[] = [];
  const closedStationIds: string[] = [];

  for (const sId of stationIds) {
    if (assignments[day]?.[sId] === true) {
      closedStationIds.push(sId);
    } else {
      openStationIds.push(sId);
    }
  }

  return {
    totalStations: stationIds.length,
    openCount: openStationIds.length,
    closedCount: closedStationIds.length,
    openStationIds,
    closedStationIds,
  };
}
