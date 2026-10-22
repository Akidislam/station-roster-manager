import React from 'react';
import { AppDataSchema, Weekday, WEEKDAYS } from '../../types';
import { analyzeFeasibility, getDailyCoverage } from '../../utils/scheduler';
import {
  Building2,
  Users,
  DoorOpen,
  DoorClosed,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  Sliders,
  Sparkles,
  FileSpreadsheet,
} from 'lucide-react';

interface DashboardProps {
  data: AppDataSchema;
  onNavigate: (tab: 'roster' | 'monthly' | 'stations' | 'reports') => void;
  onOpenPolicy: () => void;
  onOpenWizard: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  data,
  onNavigate,
  onOpenPolicy,
  onOpenWizard,
}) => {
  const { stations, members, policy, schedules, currentWeekId, declaredTotalMembers } = data;
  const currentSchedule = schedules[currentWeekId];

  // Feasibility status
  const feasibility = analyzeFeasibility(stations.length, policy);

  // Today's coverage
  const todayDayIndex = (new Date().getDay() + 6) % 7; // 0 is Monday
  const todayName: Weekday = WEEKDAYS[todayDayIndex] || 'Monday';

  const stationIds = stations.map((s) => s.id);
  const todayCoverage = currentSchedule
    ? getDailyCoverage(todayDayIndex as any ? todayName : 'Monday', stationIds, currentSchedule.assignments)
    : { openCount: stations.length, closedCount: 0, openStationIds: stationIds, closedStationIds: [] };

  const assignedMembersCount = members.filter((m) => m.stationId !== null).length;
  const memberDiscrepancy = members.length !== declaredTotalMembers;

  const validationErrors = currentSchedule?.validationErrors || [];

  return (
    <div className="space-y-6">
      {/* Top Banner: Feasibility & Health */}
      {!feasibility.isFeasible ? (
        <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl shrink-0 mt-0.5">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-rose-900 text-base">Current Policy is Mathematically Infeasible</h3>
                <span className="px-2 py-0.5 bg-rose-200 text-rose-800 text-[11px] font-semibold rounded-full">
                  Deficit Detected
                </span>
              </div>
              <p className="text-xs text-rose-700 mt-1 max-w-2xl leading-relaxed">
                {feasibility.proof
                  ? `Required weekly closures (${feasibility.proof.totalClosuresRequired}) exceed total weekly closure capacity (${feasibility.proof.maxPossibleClosures}).`
                  : feasibility.reason}
              </p>
            </div>
          </div>
          <button
            onClick={onOpenPolicy}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <Lightbulb className="w-4 h-4" />
            <span>View Suggested Alternatives</span>
          </button>
        </div>
      ) : (
        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                Policy Feasibility Verified
              </span>
              <p className="text-xs text-emerald-700">
                Current constraints are mathematically sound: capacity of {feasibility.proof?.maxPossibleClosures} slots meets requirement of {feasibility.proof?.totalClosuresRequired} slots.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenPolicy}
            className="text-xs text-emerald-800 font-semibold hover:underline inline-flex items-center gap-1"
          >
            <span>Review Rules</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Discrepancy or Validation Warnings Banner */}
      {validationErrors.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold text-amber-900">
                {validationErrors.length} Active Constraint Violation{validationErrors.length > 1 ? 's' : ''} in Roster
              </span>
              <ul className="list-disc list-inside mt-1 text-amber-800 space-y-0.5">
                {validationErrors.slice(0, 3).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {validationErrors.length > 3 && (
                  <li>...and {validationErrors.length - 3} more. Check Weekly Roster to resolve.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Stations */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Total Stations</span>
            <Building2 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{stations.length}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Active facilities</div>
          </div>
        </div>

        {/* Total Members */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Total Members</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{members.length}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {assignedMembersCount} assigned ({members.length - assignedMembersCount} unassigned)
            </div>
          </div>
        </div>

        {/* Open Today */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Open Today</span>
            <DoorOpen className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-600">{todayCoverage.openCount}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Operating on {todayName}
            </div>
          </div>
        </div>

        {/* Closed Today */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Closed Today</span>
            <DoorClosed className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-600">{todayCoverage.closedCount}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Scheduled holiday
            </div>
          </div>
        </div>

        {/* Min Required Open */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Min Open Req</span>
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{policy.minOpenStationsPerDay}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Daily safety minimum
            </div>
          </div>
        </div>

        {/* Roster Status */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Week Status</span>
            <Calendar className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-3">
            <span
              className={`inline-block px-2.5 py-1 text-xs font-bold rounded-lg ${
                !currentSchedule
                  ? 'bg-slate-100 text-slate-600'
                  : currentSchedule.isValid && currentSchedule.isPublished
                  ? 'bg-emerald-100 text-emerald-800'
                  : currentSchedule.isValid
                  ? 'bg-indigo-100 text-indigo-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {!currentSchedule
                ? 'Unscheduled'
                : currentSchedule.isValid && currentSchedule.isPublished
                ? 'Published'
                : currentSchedule.isValid
                ? 'Draft (Valid)'
                : 'Invalid Draft'}
            </span>
            <div className="text-[11px] text-slate-500 mt-1">Week {currentSchedule?.weekNumber || '--'}</div>
          </div>
        </div>
      </div>

      {/* Main Operational Overview & Quick Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Stations Operational Overview */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Station Workforce & Status Summary</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time assignment distribution and status for today ({todayName})
              </p>
            </div>
            <button
              onClick={() => onNavigate('stations')}
              className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 inline-flex items-center gap-1"
            >
              <span>Manage Stations</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {stations.map((st) => {
              const assigned = members.filter((m) => m.stationId === st.id);
              const isClosedToday = currentSchedule?.assignments[todayName]?.[st.id] === true;

              return (
                <div key={st.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        isClosedToday ? 'bg-rose-500 ring-4 ring-rose-100' : 'bg-emerald-500 ring-4 ring-emerald-100'
                      }`}
                    />
                    <div>
                      <div className="font-semibold text-sm text-slate-900">{st.name}</div>
                      <div className="text-xs text-slate-500">
                        {assigned.length} assigned member{assigned.length !== 1 ? 's' : ''}:{' '}
                        <span className="text-slate-700">
                          {assigned.length > 0 ? assigned.map((m) => m.name).join(', ') : 'None'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${
                        isClosedToday
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {isClosedToday ? 'CLOSED TODAY' : 'OPEN TODAY'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Quick Actions & Policy Card */}
        <div className="space-y-4">
          {/* Policy Card */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-slate-600" />
                <span>Closure Policy Rules</span>
              </span>
              <button
                onClick={onOpenPolicy}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                Edit
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span>Allowed Closure Days:</span>
                <span className="font-semibold text-slate-800">
                  {WEEKDAYS.filter((d) => policy.allowedClosureDays[d]).join(', ') || 'None'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span>Closures per Station:</span>
                <span className="font-semibold text-slate-800">{policy.closuresPerStation} days / week</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span>Min Open Stations:</span>
                <span className="font-semibold text-slate-800">{policy.minOpenStationsPerDay} stations</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Max Closures Allowed:</span>
                <span className="font-semibold text-slate-800">
                  {Math.max(0, stations.length - policy.minOpenStationsPerDay)} stations / day
                </span>
              </div>
            </div>
          </div>

          {/* Quick Nav Card */}
          <div className="bg-indigo-600 text-white rounded-2xl p-5 space-y-3 shadow-md">
            <h4 className="font-bold text-sm">Roster & Operational Exports</h4>
            <p className="text-xs text-indigo-100 leading-relaxed">
              Open the interactive schedule table to view weekly assignments, or generate calendar-accurate monthly rosters with Google Sheets and Excel export.
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => onNavigate('monthly')}
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Monthly Roster & Spreadsheet Export</span>
              </button>
              <button
                onClick={() => onNavigate('roster')}
                className="w-full py-2 bg-white text-indigo-700 hover:bg-indigo-50 font-semibold text-xs rounded-xl transition-colors shadow-xs"
              >
                Open Weekly Roster Table
              </button>
              <button
                onClick={onOpenWizard}
                className="w-full py-1.5 bg-indigo-700/60 hover:bg-indigo-700 text-indigo-100 font-medium text-xs rounded-xl transition-colors"
              >
                Rerun Setup Wizard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
