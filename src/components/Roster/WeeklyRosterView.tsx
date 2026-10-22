import React, { useState, useMemo } from 'react';
import {
  AppDataSchema,
  ClosureHistory,
  Weekday,
  WEEKDAYS,
  WeekSchedule,
} from '../../types';
import {
  analyzeFeasibility,
  generateOptimalRoster,
  validateSchedule,
} from '../../utils/scheduler';
import { exportRosterToCSV, triggerFileDownload } from '../../utils/csvExport';
import { formatDate, getWeekDates, getISOWeekInfo } from '../../utils/storage';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Search,
  Undo2,
  Save,
  Check,
  ShieldAlert,
  Info,
  Sliders,
  Users,
} from 'lucide-react';

interface WeeklyRosterViewProps {
  data: AppDataSchema;
  onUpdateSchedule: (schedule: WeekSchedule) => void;
  onOpenPolicy: () => void;
}

export const WeeklyRosterView: React.FC<WeeklyRosterViewProps> = ({
  data,
  onUpdateSchedule,
  onOpenPolicy,
}) => {
  const { stations, members, policy, schedules, currentWeekId } = data;

  // Selected week ID (defaults to currentWeekId or generates standard week)
  const [selectedWeekId, setSelectedWeekId] = useState<string>(currentWeekId);
  const [stationFilter, setStationFilter] = useState<string>('all');
  const [searchMemberQuery, setSearchMemberQuery] = useState<string>('');

  // Manual draft editing state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [draftAssignments, setDraftAssignments] = useState<Record<Weekday, Record<string, boolean>> | null>(null);
  const [historyDrafts, setHistoryDrafts] = useState<Record<Weekday, Record<string, boolean>>[]>([]);
  const [publishFeedback, setPublishFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    details?: string[];
    timestamp: number;
  } | null>(null);

  // Current active schedule for selected week
  const schedule = useMemo(() => {
    if (schedules[selectedWeekId]) {
      return schedules[selectedWeekId];
    }
    // If not existing, create blank schedule
    const weekInfo = getISOWeekInfo();
    const emptyGrid: Record<Weekday, Record<string, boolean>> = {
      Monday: {},
      Tuesday: {},
      Wednesday: {},
      Thursday: {},
      Friday: {},
      Saturday: {},
      Sunday: {},
    };
    for (const d of WEEKDAYS) {
      for (const s of stations) {
        emptyGrid[d][s.id] = false;
      }
    }
    const blank: WeekSchedule = {
      weekId: selectedWeekId,
      weekNumber: weekInfo.weekNumber,
      year: weekInfo.year,
      startDate: weekInfo.mondayDate,
      assignments: emptyGrid,
      isPublished: false,
      isValid: false,
      validationErrors: ['Schedule has not been generated or filled yet.'],
      lastModified: Date.now(),
    };
    return blank;
  }, [schedules, selectedWeekId, stations]);

  // Current active assignments (either editing draft or schedule assignments)
  const activeAssignments = draftAssignments || schedule.assignments;

  // Station metadata lookup
  const stationNames = useMemo(
    () => Object.fromEntries(stations.map((s) => [s.id, s.name])),
    [stations]
  );
  const stationIds = useMemo(() => stations.map((s) => s.id), [stations]);

  // Real-time live validation
  const validationErrors = useMemo(() => {
    return validateSchedule(stationIds, stationNames, policy, activeAssignments);
  }, [stationIds, stationNames, policy, activeAssignments]);

  const isValid = validationErrors.length === 0;

  // Feasibility status of policy
  const feasibility = analyzeFeasibility(stations.length, policy);

  // Week Dates
  const weekDates = useMemo(
    () => getWeekDates(schedule.startDate),
    [schedule.startDate]
  );

  // Group members by station
  const stationMembers = useMemo(() => {
    const map: Record<string, typeof members> = {};
    for (const s of stations) {
      map[s.id] = members.filter((m) => m.stationId === s.id);
    }
    return map;
  }, [stations, members]);

  // Filtered stations based on stationFilter & member search
  const visibleStations = useMemo(() => {
    return stations.filter((s) => {
      if (stationFilter !== 'all' && s.id !== stationFilter) {
        return false;
      }
      if (searchMemberQuery.trim()) {
        const query = searchMemberQuery.toLowerCase();
        const mems = stationMembers[s.id] || [];
        const hasMemberMatch = mems.some((m) => m.name.toLowerCase().includes(query));
        const hasStationMatch = s.name.toLowerCase().includes(query);
        return hasMemberMatch || hasStationMatch;
      }
      return true;
    });
  }, [stations, stationFilter, searchMemberQuery, stationMembers]);

  // Auto-generate optimal roster
  const handleAutoSchedule = () => {
    if (!feasibility.isFeasible) {
      onOpenPolicy();
      return;
    }

    // Build historical closure counts from other saved weeks for fairness calculation
    const history: ClosureHistory = {};
    for (const s of stations) {
      history[s.id] = {
        Monday: 0,
        Tuesday: 0,
        Wednesday: 0,
        Thursday: 0,
        Friday: 0,
        Saturday: 0,
        Sunday: 0,
      };
    }

    for (const [wId, wSched] of Object.entries(schedules)) {
      if (wId !== selectedWeekId && wSched.assignments) {
        for (const day of WEEKDAYS) {
          for (const s of stations) {
            if (wSched.assignments[day]?.[s.id]) {
              history[s.id][day]++;
            }
          }
        }
      }
    }

    const result = generateOptimalRoster(stationIds, policy, history);

    if (result.success) {
      const errors = validateSchedule(stationIds, stationNames, policy, result.assignments);
      const newSchedule: WeekSchedule = {
        ...schedule,
        assignments: result.assignments,
        isValid: errors.length === 0,
        validationErrors: errors,
        isPublished: false,
        lastModified: Date.now(),
      };
      setDraftAssignments(null);
      setIsEditing(false);
      onUpdateSchedule(newSchedule);
    }
  };

  // Toggle cell status during manual edit
  const handleToggleCell = (stationId: string, day: Weekday) => {
    // If not in editing mode, activate it
    const current = draftAssignments
      ? JSON.parse(JSON.stringify(draftAssignments))
      : JSON.parse(JSON.stringify(schedule.assignments));

    // Save previous state to history stack for undo
    setHistoryDrafts((prev) => [...prev, current]);

    const isCurrentlyClosed = current[day]?.[stationId] === true;
    current[day][stationId] = !isCurrentlyClosed;

    setDraftAssignments(current);
    setIsEditing(true);
  };

  // Undo manual change
  const handleUndo = () => {
    if (historyDrafts.length === 0) return;
    const previous = historyDrafts[historyDrafts.length - 1];
    setHistoryDrafts((prev) => prev.slice(0, -1));
    setDraftAssignments(previous);
  };

  // Discard all draft changes
  const handleDiscardChanges = () => {
    setDraftAssignments(null);
    setHistoryDrafts([]);
    setIsEditing(false);
  };

  // Save manual changes as draft
  const handleSaveDraft = () => {
    if (!draftAssignments) return;
    const errors = validateSchedule(stationIds, stationNames, policy, draftAssignments);
    const updated: WeekSchedule = {
      ...schedule,
      assignments: draftAssignments,
      isValid: errors.length === 0,
      validationErrors: errors,
      isPublished: false,
      lastModified: Date.now(),
    };
    onUpdateSchedule(updated);
    setDraftAssignments(null);
    setIsEditing(false);
  };

  // Publish Schedule (Strictly requires isValid)
  const handlePublish = () => {
    const finalAssignments = draftAssignments || schedule.assignments;
    const errors = validateSchedule(stationIds, stationNames, policy, finalAssignments);

    if (errors.length > 0) {
      setPublishFeedback({
        type: 'error',
        message: 'Publishing blocked: Roster has active constraint violations.',
        details: [
          'The previously published roster remains active and untouched.',
          ...errors,
        ],
        timestamp: Date.now(),
      });
      return;
    }

    const published: WeekSchedule = {
      ...schedule,
      assignments: finalAssignments,
      isValid: true,
      validationErrors: [],
      isPublished: true,
      lastModified: Date.now(),
    };
    onUpdateSchedule(published);
    setDraftAssignments(null);
    setHistoryDrafts([]);
    setIsEditing(false);

    setPublishFeedback({
      type: 'success',
      message: 'Weekly roster published. Monthly roster synchronized.',
      timestamp: Date.now(),
    });
  };

  // Export CSV
  const handleExportCSV = () => {
    const csvData = exportRosterToCSV(schedule, stations, members);
    triggerFileDownload(csvData, `Station_Roster_${selectedWeekId}.csv`, 'text/csv;charset=utf-8;');
  };

  // Print Roster
  const handlePrint = () => {
    window.print();
  };

  // Navigation: Next / Prev Week
  const handleWeekChange = (offset: number) => {
    const [yearStr, wPart] = selectedWeekId.split('-W');
    let year = parseInt(yearStr);
    let week = parseInt(wPart) + offset;
    if (week < 1) {
      week = 52;
      year -= 1;
    } else if (week > 52) {
      week = 1;
      year += 1;
    }
    const newWeekId = `${year}-W${String(week).padStart(2, '0')}`;
    setSelectedWeekId(newWeekId);
    setDraftAssignments(null);
    setIsEditing(false);
  };

  // Calculate closure counts for each station across the week
  const getStationClosureCount = (stationId: string) => {
    let count = 0;
    for (const d of WEEKDAYS) {
      if (activeAssignments[d]?.[stationId]) count++;
    }
    return count;
  };

  // Calculate open/closed counts for each day
  const dailyMetrics = useMemo(() => {
    const res: Record<Weekday, { open: number; closed: number; meetsMin: boolean; allowed: boolean }> = {} as any;
    for (const d of WEEKDAYS) {
      let closed = 0;
      for (const sId of stationIds) {
        if (activeAssignments[d]?.[sId]) closed++;
      }
      const open = stationIds.length - closed;
      const meetsMin = open >= policy.minOpenStationsPerDay;
      const allowed = policy.allowedClosureDays[d];
      res[d] = { open, closed, meetsMin, allowed };
    }
    return res;
  }, [activeAssignments, stationIds, policy]);

  return (
    <div className="space-y-6">
      {/* Top Header Controls (Excluded in print view via CSS) */}
      <div className="print:hidden space-y-4">
        {/* Row 1: Week Selector & Action Buttons */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          {/* Week Selector */}
          <div className="flex items-center gap-3">
            <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-slate-50">
              <button
                type="button"
                onClick={() => handleWeekChange(-1)}
                className="p-2 hover:bg-slate-200/60 text-slate-600 transition-colors"
                title="Previous Week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-4 py-1.5 text-xs font-bold text-slate-800 bg-white border-x border-slate-200 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>{selectedWeekId}</span>
              </div>
              <button
                type="button"
                onClick={() => handleWeekChange(1)}
                className="p-2 hover:bg-slate-200/60 text-slate-600 transition-colors"
                title="Next Week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-500 hidden sm:block">
              Starts Monday, {formatDate(schedule.startDate)}
            </div>

            <span
              className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${
                schedule.isPublished && isValid
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : isValid
                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                  : 'bg-rose-100 text-rose-800 border border-rose-200'
              }`}
            >
              {schedule.isPublished && isValid ? 'Published' : isValid ? 'Valid Draft' : 'Violates Constraints'}
            </span>

            {/* Synchronization Status Indicator */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-full text-[11px] text-slate-600">
              <span
                className={`w-2 h-2 rounded-full ${
                  schedule.isPublished && isValid && !draftAssignments
                    ? 'bg-emerald-500'
                    : 'bg-amber-400'
                }`}
              />
              <span className="font-medium">
                {schedule.isPublished && isValid && !draftAssignments
                  ? `Synced with Monthly Roster (Updated ${new Date(schedule.lastModified).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                  : draftAssignments
                  ? 'Unpublished Draft (In Progress)'
                  : 'Unpublished Draft (Not Synced)'}
              </span>
            </div>
          </div>

          {/* Right Action Tools */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAutoSchedule}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
              title="Automatically generate mathematically optimal schedule"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Roster</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors shadow-xs"
              title="Export complete schedule to CSV format"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors shadow-xs"
              title="Print view"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Row 2: Search, Filters & Editing Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-4 py-3 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3 flex-1">
            {/* Filter by Station */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={stationFilter}
                onChange={(e) => setStationFilter(e.target.value)}
                className="px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Stations ({stations.length})</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Member search */}
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchMemberQuery}
                onChange={(e) => setSearchMemberQuery(e.target.value)}
                placeholder="Search member name..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Manual Editing Status & Actions */}
          <div className="flex items-center gap-2">
            {isEditing && (
              <>
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={historyDrafts.length === 0}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg transition-colors"
                >
                  <Undo2 className="w-3 h-3" />
                  <span>Undo</span>
                </button>

                <button
                  type="button"
                  onClick={handleDiscardChanges}
                  className="px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  Discard
                </button>

                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <Save className="w-3 h-3" />
                  <span>Save Draft</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handlePublish}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg shadow-xs transition-colors ${
                isValid
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
              }`}
              title={
                isValid
                  ? 'Publish current valid roster to synchronize with Monthly Roster'
                  : 'Cannot publish: Roster has active constraint violations. Click to review errors.'
              }
            >
              <Check className="w-3.5 h-3.5" />
              <span>{schedule.isPublished && !isEditing ? 'Published ✓' : 'Publish Roster'}</span>
            </button>
          </div>
        </div>

        {/* Publish Feedback Notice */}
        {publishFeedback && (
          <div
            className={`p-4 rounded-xl border flex items-start justify-between gap-3 animate-in fade-in ${
              publishFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-rose-50 border-rose-300 text-rose-950'
            }`}
          >
            <div className="flex items-start gap-3">
              {publishFeedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 text-xs">
                <div className="font-bold text-sm">
                  {publishFeedback.message}
                </div>
                {publishFeedback.type === 'success' && (
                  <p className="text-emerald-700 leading-relaxed">
                    The published station statuses for {selectedWeekId} are now authoritative. All corresponding calendar dates in the Monthly Roster and spreadsheet exports have been automatically synchronized.
                  </p>
                )}
                {publishFeedback.details && publishFeedback.details.length > 0 && (
                  <ul className="text-rose-700 list-disc list-inside space-y-0.5 mt-1 font-medium">
                    {publishFeedback.details.map((det, idx) => (
                      <li key={idx}>{det}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <button
              onClick={() => setPublishFeedback(null)}
              className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              aria-label="Dismiss feedback"
            >
              ✕
            </button>
          </div>
        )}

        {/* Validation Errors Notice */}
        {validationErrors.length > 0 && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
            <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Constraint Violations ({validationErrors.length}) - Publishing Blocked:</span>
            </div>
            <ul className="text-xs text-rose-700 list-disc list-inside space-y-0.5 pl-1">
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Print Header (Only visible when printing) */}
      <div className="hidden print:block mb-4 border-b pb-2">
        <h1 className="text-2xl font-bold text-slate-900">Weekly Station Operating & Closure Roster</h1>
        <p className="text-sm text-slate-600">
          Week: {selectedWeekId} (Starting {formatDate(schedule.startDate)}) • Stations: {stations.length} • Min Open: {policy.minOpenStationsPerDay}
        </p>
      </div>

      {/* Roster Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                <th className="p-4 w-64 min-w-[220px] sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                  <div className="flex items-center justify-between">
                    <span>Station & Assigned Team</span>
                    <span className="text-[10px] text-slate-400 font-normal">Closures Req: {policy.closuresPerStation}</span>
                  </div>
                </th>
                {WEEKDAYS.map((day) => {
                  const isAllowed = policy.allowedClosureDays[day];
                  const dateStr = weekDates[day];
                  return (
                    <th
                      key={day}
                      className={`p-3 min-w-[140px] text-center border-r border-slate-200 last:border-r-0 ${
                        !isAllowed ? 'bg-slate-100/60' : ''
                      }`}
                    >
                      <div className="font-bold text-slate-900">{day}</div>
                      <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                        {dateStr ? formatDate(dateStr).split(',')[0] : ''}
                      </div>
                      <div className="mt-1">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                            isAllowed
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {isAllowed ? 'Closures Allowed' : 'Full Staffing'}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 text-xs">
              {visibleStations.map((station) => {
                const assignedMems = stationMembers[station.id] || [];
                const closureCount = getStationClosureCount(station.id);
                const hasCorrectClosureCount = closureCount === policy.closuresPerStation;

                return (
                  <tr key={station.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Station Name & Assigned Members */}
                    <td className="p-4 sticky left-0 bg-white z-10 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-slate-900">{station.name}</span>
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                              hasCorrectClosureCount
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                            title={`Requires exactly ${policy.closuresPerStation} closure days per week`}
                          >
                            {closureCount} / {policy.closuresPerStation} Days Off
                          </span>
                        </div>

                        {/* Assigned Member List */}
                        <div className="text-[11px] text-slate-500">
                          <div className="font-medium text-slate-700 flex items-center gap-1">
                            <Users className="w-3 h-3 text-slate-400" />
                            <span>{assignedMems.length} member{assignedMems.length !== 1 ? 's' : ''}:</span>
                          </div>
                          {assignedMems.length > 0 ? (
                            <div className="text-slate-600 line-clamp-2 mt-0.5">
                              {assignedMems.map((m) => m.name).join(', ')}
                            </div>
                          ) : (
                            <span className="text-rose-500 italic text-[10px]">No members assigned</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Weekday Columns */}
                    {WEEKDAYS.map((day) => {
                      const isClosed = activeAssignments[day]?.[station.id] === true;
                      const isAllowedClosureDay = policy.allowedClosureDays[day];
                      const isProhibitedViolation = !isAllowedClosureDay && isClosed;

                      return (
                        <td
                          key={day}
                          onClick={() => handleToggleCell(station.id, day)}
                          className={`p-3 text-center border-r border-slate-200 last:border-r-0 cursor-pointer select-none transition-all group ${
                            isClosed
                              ? isProhibitedViolation
                                ? 'bg-rose-100 hover:bg-rose-200/90'
                                : 'bg-rose-50 hover:bg-rose-100/80'
                              : 'bg-emerald-50/40 hover:bg-emerald-100/60'
                          }`}
                          title={`Click to toggle ${station.name} status on ${day}`}
                        >
                          <div className="flex flex-col items-center justify-center space-y-1 py-1">
                            {/* Accessible Status Badge with both icon, color, and clear label */}
                            <div
                              className={`px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs border ${
                                isClosed
                                  ? isProhibitedViolation
                                    ? 'bg-rose-600 text-white border-rose-700'
                                    : 'bg-rose-100 text-rose-800 border-rose-300'
                                  : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  isClosed ? (isProhibitedViolation ? 'bg-white' : 'bg-rose-600') : 'bg-emerald-600'
                                }`}
                              />
                              <span>{isClosed ? 'CLOSED' : 'OPEN'}</span>
                            </div>

                            {/* Holiday badge or Operating details */}
                            <div className="text-[10px] text-slate-500 font-medium">
                              {isClosed ? (
                                <span className={isProhibitedViolation ? 'text-rose-700 font-bold' : 'text-rose-600'}>
                                  {isProhibitedViolation ? 'Prohibited Day!' : 'Station Holiday'}
                                </span>
                              ) : (
                                <span className="text-emerald-700">Operating</span>
                              )}
                            </div>

                            {/* Member effect indicator */}
                            <div className="text-[9px] text-slate-400 group-hover:text-slate-600">
                              {isClosed ? 'Team off' : `${assignedMems.length} on duty`}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>

            {/* Daily Summary & Compliance Footer */}
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300 text-xs">
                <td className="p-4 sticky left-0 bg-slate-100 z-10 border-r border-slate-200 font-bold text-slate-800">
                  <div className="space-y-0.5">
                    <div>Daily Operating Coverage</div>
                    <div className="text-[10px] font-normal text-slate-500">
                      Minimum required open: {policy.minOpenStationsPerDay}
                    </div>
                  </div>
                </td>

                {WEEKDAYS.map((day) => {
                  const metric = dailyMetrics[day];
                  return (
                    <td
                      key={day}
                      className={`p-3 text-center border-r border-slate-200 last:border-r-0 ${
                        !metric.meetsMin ? 'bg-rose-100' : ''
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-slate-900">
                          {metric.open} Open <span className="text-slate-400 font-normal">/ {metric.closed} Closed</span>
                        </div>
                        <div
                          className={`text-[10px] font-semibold inline-block px-1.5 py-0.5 rounded ${
                            metric.meetsMin
                              ? 'text-emerald-700 bg-emerald-100/80'
                              : 'text-rose-700 bg-rose-200'
                          }`}
                        >
                          {metric.meetsMin ? '✓ Coverage Met' : `✕ Deficit (< ${policy.minOpenStationsPerDay})`}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Manual Editing Help Guide */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-3 print:hidden">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-slate-800">Manual Scheduling Guide:</span>
          <p className="leading-relaxed">
            Click on any station cell to toggle its status between <strong>OPEN</strong> and <strong>CLOSED</strong>. All mathematical constraints (prohibited closure days, 2 closures per station, and minimum open station thresholds) are validated instantaneously. You cannot publish a roster until all constraints pass.
          </p>
        </div>
      </div>
    </div>
  );
};
