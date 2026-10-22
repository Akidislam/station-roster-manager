import React, { useMemo, useState } from 'react';
import { AppDataSchema, Weekday, WEEKDAYS } from '../../types';
import { formatDate } from '../../utils/storage';
import {
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  History,
  TrendingUp,
  ShieldCheck,
  Calendar,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';

interface ReportsViewProps {
  data: AppDataSchema;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ data }) => {
  const { stations, members, schedules, currentWeekId, policy } = data;
  const [selectedWeek, setSelectedWeek] = useState<string>(currentWeekId);

  const activeSchedule = schedules[selectedWeek] || schedules[currentWeekId];

  // 1. Weekly Station Opening & Closure Metrics for selected week
  const weeklyStationStats = useMemo(() => {
    if (!activeSchedule) return [];
    return stations.map((st) => {
      let closedDays: Weekday[] = [];
      let openDays: Weekday[] = [];
      for (const d of WEEKDAYS) {
        if (activeSchedule.assignments[d]?.[st.id]) {
          closedDays.push(d);
        } else {
          openDays.push(d);
        }
      }
      const assignedCount = members.filter((m) => m.stationId === st.id).length;
      return {
        stationId: st.id,
        stationName: st.name,
        assignedCount,
        closedDays,
        openDays,
        closureCount: closedDays.length,
        isCompliant: closedDays.length === policy.closuresPerStation,
      };
    });
  }, [stations, members, activeSchedule, policy]);

  // 2. Daily Operating Coverage Metrics
  const dailyCoverageStats = useMemo(() => {
    if (!activeSchedule) return [];
    return WEEKDAYS.map((day) => {
      let open = 0;
      let closed = 0;
      for (const st of stations) {
        if (activeSchedule.assignments[day]?.[st.id]) {
          closed++;
        } else {
          open++;
        }
      }
      const isAllowed = policy.allowedClosureDays[day];
      const meetsMin = open >= policy.minOpenStationsPerDay;
      const prohibitedViolation = !isAllowed && closed > 0;
      return {
        day,
        open,
        closed,
        isAllowed,
        meetsMin,
        prohibitedViolation,
      };
    });
  }, [stations, activeSchedule, policy]);

  // 3. Station-wise Historical Cumulative Closures across all stored weeks
  const cumulativeHistory = useMemo(() => {
    const hist: Record<string, { totalClosures: number; dayBreakdown: Record<Weekday, number> }> = {};
    for (const st of stations) {
      hist[st.id] = {
        totalClosures: 0,
        dayBreakdown: {
          Monday: 0,
          Tuesday: 0,
          Wednesday: 0,
          Thursday: 0,
          Friday: 0,
          Saturday: 0,
          Sunday: 0,
        },
      };
    }

    const weeksCount = Object.keys(schedules).length;
    for (const sched of Object.values(schedules)) {
      if (!sched.assignments) continue;
      for (const d of WEEKDAYS) {
        for (const st of stations) {
          if (sched.assignments[d]?.[st.id]) {
            if (hist[st.id]) {
              hist[st.id].totalClosures++;
              hist[st.id].dayBreakdown[d]++;
            }
          }
        }
      }
    }

    return { hist, weeksCount };
  }, [stations, schedules]);

  // 4. Fairness and Weekday Rotation Report
  const weekdayDistribution = useMemo(() => {
    const dist: Record<Weekday, number> = {
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
      Sunday: 0,
    };
    for (const item of Object.values(cumulativeHistory.hist)) {
      for (const d of WEEKDAYS) {
        dist[d] += item.dayBreakdown[d];
      }
    }
    return dist;
  }, [cumulativeHistory]);

  // 5. Active Constraint Violations in current schedule
  const activeErrors = activeSchedule?.validationErrors || [];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Operational Audits & Scheduling Reports</h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time compliance validation, daily coverage thresholds, and historical rotation fairness.
          </p>
        </div>

        {/* Week Selector */}
        <div className="flex items-center gap-2 text-xs">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span className="font-semibold text-slate-700">Audit Week:</span>
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800"
          >
            {Object.keys(schedules).map((wId) => (
              <option key={wId} value={wId}>
                {wId}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Report 1: Weekly Station Opening & Closure Compliance */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-base text-slate-900">Station Opening & Closure Compliance</h3>
          </div>
          <span className="text-xs text-slate-500">
            Target: Exactly {policy.closuresPerStation} days off per station
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <th className="p-3">Station Name</th>
                <th className="p-3">Assigned Workforce</th>
                <th className="p-3">Closure Days (Holiday)</th>
                <th className="p-3">Operating Days</th>
                <th className="p-3 text-center">Closure Total</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {weeklyStationStats.map((row) => (
                <tr key={row.stationId} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{row.stationName}</td>
                  <td className="p-3 text-slate-600">{row.assignedCount} members</td>
                  <td className="p-3 font-semibold text-rose-700">
                    {row.closedDays.length > 0 ? row.closedDays.join(', ') : 'None (No days off)'}
                  </td>
                  <td className="p-3 text-emerald-700">{row.openDays.join(', ')}</td>
                  <td className="p-3 text-center font-bold">
                    <span
                      className={`px-2 py-0.5 rounded ${
                        row.isCompliant ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {row.closureCount} / {policy.closuresPerStation}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {row.isCompliant ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-4 h-4" /> Passed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-600 font-semibold">
                        <AlertTriangle className="w-4 h-4" /> Non-compliant
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report 2: Daily Operating Coverage Report */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-base text-slate-900">Daily Operating Coverage vs Thresholds</h3>
          </div>
          <span className="text-xs text-slate-500">
            Minimum required open stations: {policy.minOpenStationsPerDay}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {dailyCoverageStats.map((st) => (
            <div
              key={st.day}
              className={`p-3 rounded-xl border text-center space-y-1 ${
                st.meetsMin && !st.prohibitedViolation
                  ? 'bg-emerald-50/50 border-emerald-200'
                  : 'bg-rose-50 border-rose-200'
              }`}
            >
              <div className="font-bold text-xs text-slate-800">{st.day}</div>
              <div className="text-lg font-extrabold text-slate-900">{st.open} Open</div>
              <div className="text-[11px] text-slate-500">{st.closed} Closed</div>
              <div className="pt-1">
                <span
                  className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${
                    st.meetsMin && !st.prohibitedViolation
                      ? 'bg-emerald-200 text-emerald-900'
                      : 'bg-rose-200 text-rose-900'
                  }`}
                >
                  {st.prohibitedViolation
                    ? 'Prohibited Day!'
                    : st.meetsMin
                    ? 'Coverage OK'
                    : 'Below Minimum'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Report 3: Fairness & Weekday Rotation Report */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cumulative Historical Station Closures */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-base text-slate-900">Cumulative Station Closures</h3>
          </div>
          <p className="text-xs text-slate-500">
            Total holiday assignments recorded per station across all {cumulativeHistory.weeksCount} saved week(s).
          </p>

          <div className="divide-y divide-slate-100 text-xs">
            {stations.map((st) => {
              const hist = cumulativeHistory.hist[st.id];
              return (
                <div key={st.id} className="py-2.5 flex items-center justify-between">
                  <div className="font-semibold text-slate-800">{st.name}</div>
                  <div className="flex items-center gap-4 text-slate-600">
                    <span className="font-bold text-indigo-700">{hist?.totalClosures || 0} total days off</span>
                    <span className="text-[10px] text-slate-400">
                      (Thu: {hist?.dayBreakdown.Thursday || 0}, Fri: {hist?.dayBreakdown.Friday || 0}, Sat:{' '}
                      {hist?.dayBreakdown.Saturday || 0}, Sun: {hist?.dayBreakdown.Sunday || 0})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekday Distribution Balance */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-base text-slate-900">Weekday Distribution Balance</h3>
          </div>
          <p className="text-xs text-slate-500">
            Cumulative closures across weekdays to monitor equitable distribution.
          </p>

          <div className="space-y-2 text-xs">
            {WEEKDAYS.map((day) => {
              const count = weekdayDistribution[day];
              const isAllowed = policy.allowedClosureDays[day];
              return (
                <div key={day} className="flex items-center gap-3">
                  <div className="w-24 font-medium text-slate-700">{day}</div>
                  <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isAllowed ? 'bg-indigo-600' : 'bg-slate-300'
                      }`}
                      style={{ width: `${Math.min(100, count * 15)}%` }}
                    />
                  </div>
                  <div className="w-12 text-right font-bold text-slate-900">{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Report 4: Constraint Violation Audit Log */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-base text-slate-900">Constraint Violation Audit Log</h3>
          </div>
          <span
            className={`px-2.5 py-1 text-xs font-bold rounded-lg ${
              activeErrors.length === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}
          >
            {activeErrors.length === 0 ? '0 Violations (Clean Audit)' : `${activeErrors.length} Violations Detected`}
          </span>
        </div>

        {activeErrors.length === 0 ? (
          <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>All mandatory mathematical rules and operational thresholds are fully satisfied for {selectedWeek}.</span>
          </div>
        ) : (
          <ul className="space-y-2">
            {activeErrors.map((err, i) => (
              <li
                key={i}
                className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{err}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
