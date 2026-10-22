import React, { useState, useMemo } from 'react';
import { AppDataSchema, MonthlyRoster, Station } from '../../types';
import { generateMonthlyRoster, MONTH_NAMES } from '../../utils/monthlyScheduler';
import { downloadMonthlyExcel, downloadMonthlyCSV } from '../../utils/monthlyExport';
import {
  Calendar,
  FileSpreadsheet,
  Download,
  Printer,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Coffee,
  Info,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  ExternalLink,
} from 'lucide-react';

interface MonthlyRosterViewProps {
  data: AppDataSchema;
  onOpenPolicy: () => void;
  onUpdateStations?: (stations: Station[]) => void;
}

export const MonthlyRosterView: React.FC<MonthlyRosterViewProps> = ({
  data,
  onOpenPolicy,
  onUpdateStations,
}) => {
  const { stations, members, policy, schedules } = data;

  const today = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1); // 1-12
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStationId, setFilterStationId] = useState<string>('all');

  // Feedback states
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [exportMessage, setExportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Generate monthly roster memoized based on inputs
  const monthlyRoster: MonthlyRoster = useMemo(() => {
    return generateMonthlyRoster(
      selectedYear,
      selectedMonth,
      stations,
      members,
      policy,
      schedules,
      data.latestPublishedWeekId
    );
  }, [selectedYear, selectedMonth, stations, members, policy, schedules, data.latestPublishedWeekId, data.lastPublishedAt]);

  // Quick month navigation
  const handleMonthOffset = (offset: number) => {
    let newMonth = selectedMonth + offset;
    let newYear = selectedYear;

    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }

    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
    setExportMessage(null);
  };

  // Excel Export Handler
  const handleExportExcel = async () => {
    if (!monthlyRoster.isFeasible) {
      setExportMessage({
        type: 'error',
        text: 'Cannot export roster: Current scheduling constraints are mathematically infeasible.',
      });
      return;
    }

    try {
      setIsExportingExcel(true);
      setExportMessage(null);
      await downloadMonthlyExcel(monthlyRoster);
      setExportMessage({
        type: 'success',
        text: `Excel workbook "Station-Roster-${monthlyRoster.monthName}-${monthlyRoster.year}.xlsx" downloaded successfully. You can open it in Google Sheets or Microsoft Excel.`,
      });
    } catch (err: any) {
      console.error('Failed to export Excel:', err);
      setExportMessage({
        type: 'error',
        text: `Export failed: ${err?.message || 'Unexpected error creating spreadsheet'}.`,
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    if (!monthlyRoster.isFeasible) {
      setExportMessage({
        type: 'error',
        text: 'Cannot export CSV: Current scheduling constraints are mathematically infeasible.',
      });
      return;
    }

    try {
      downloadMonthlyCSV(monthlyRoster);
      setExportMessage({
        type: 'success',
        text: `CSV data file "Station-Roster-${monthlyRoster.monthName}-${monthlyRoster.year}.csv" downloaded successfully. UTF-8 Unicode characters preserved.`,
      });
    } catch (err: any) {
      console.error('Failed to export CSV:', err);
      setExportMessage({
        type: 'error',
        text: `Export failed: ${err?.message || 'Unexpected error creating CSV'}.`,
      });
    }
  };

  // Filter visible stations based on selector
  const visibleStations = useMemo(() => {
    if (filterStationId === 'all') return stations;
    return stations.filter((s) => s.id === filterStationId);
  }, [stations, filterStationId]);

  return (
    <div className="space-y-6">
      {/* Top Banner: Month & Year Selector + Action Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs print:hidden space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Monthly Station Roster & Spreadsheet Export
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Generate calendar-accurate monthly schedules and export styled workbooks ready for Google Sheets and Excel.
            </p>
          </div>

          {/* Month & Year Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-slate-50">
              <button
                type="button"
                onClick={() => handleMonthOffset(-1)}
                className="p-2 hover:bg-slate-200/70 text-slate-600 transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 px-3 py-1.5 bg-white border-x border-slate-200">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={name} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                >
                  {[2024, 2025, 2026, 2027, 2028].map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => handleMonthOffset(1)}
                className="p-2 hover:bg-slate-200/70 text-slate-600 transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Export Actions */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExportingExcel || !monthlyRoster.isFeasible}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition-all ${
                monthlyRoster.isFeasible
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
              title="Download formatted Excel (.xlsx) file with Google Sheets styling"
            >
              <Download className={`w-4 h-4 ${isExportingExcel ? 'animate-bounce' : ''}`} />
              <span>{isExportingExcel ? 'Generating Excel...' : 'Export Excel (.xlsx)'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={!monthlyRoster.isFeasible}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border rounded-xl transition-all ${
                monthlyRoster.isFeasible
                  ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                  : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
              }`}
              title="Download plain UTF-8 CSV data file"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors"
              title="Print view"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Feedback message banner */}
        {exportMessage && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 animate-in fade-in ${
              exportMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {exportMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-medium">{exportMessage.text}</span>
            </div>
            <button
              onClick={() => setExportMessage(null)}
              className="text-slate-400 hover:text-slate-600 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Synchronization Status Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                monthlyRoster.isSynchronizedWithWeekly ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-indigo-400'
              }`}
            />
            {monthlyRoster.isSynchronizedWithWeekly ? (
              <span className="font-semibold text-slate-800">
                Authoritative Sync Active: Synchronized with published weekly roster{' '}
                <span className="text-indigo-600 font-mono">({monthlyRoster.sourceScheduleWeekId})</span>
                {monthlyRoster.lastSynchronizedAt && (
                  <span className="text-slate-500 font-normal ml-1">
                    • Last updated {new Date(monthlyRoster.lastSynchronizedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-slate-600">
                Preview Mode: Operating under standard policy rules (no weekly schedule published yet).
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3 text-slate-400" />
            <span>Auto-refreshes when Weekly Roster is published</span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-600">Filter Station:</span>
            <select
              value={filterStationId}
              onChange={(e) => setFilterStationId(e.target.value)}
              className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
            >
              <option value="all">All Stations ({stations.length})</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search member name..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Infeasibility Warning Banner */}
      {!monthlyRoster.isFeasible && (
        <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl shrink-0 mt-0.5">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-rose-900 text-base">
                Cannot Generate Monthly Roster: Policy Infeasibility Detected
              </h3>
              <p className="text-xs text-rose-700 mt-1 max-w-2xl leading-relaxed whitespace-pre-line">
                {monthlyRoster.feasibilityReason}
              </p>
            </div>
          </div>
          <button
            onClick={onOpenPolicy}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs"
          >
            <span>Review & Adjust Policy Rules</span>
          </button>
        </div>
      )}

      {/* Google Sheets Guide & Format Notice */}
      <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-4 text-xs text-indigo-900 print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold">Opening in Google Sheets:</span>
            <p className="text-indigo-800 text-[11px] leading-relaxed">
              Export the <strong>.xlsx</strong> file, then open <strong>Google Drive</strong> &gt; Click <strong>New &gt; File upload</strong> &gt; Select the downloaded file &gt; Open with <strong>Google Sheets</strong>. All cell highlights, headers, and column widths are preserved!
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2 text-[11px] text-indigo-700 font-medium">
          <span className="px-2 py-0.5 bg-white border border-indigo-200 rounded-md">
            {monthlyRoster.totalDays} Calendar Days
          </span>
          <span className="px-2 py-0.5 bg-white border border-indigo-200 rounded-md">
            {stations.length} Stations
          </span>
        </div>
      </div>

      {/* Printable Title Header (Visible during Print) */}
      <div className="hidden print:block mb-4 border-b pb-2">
        <h1 className="text-2xl font-bold text-slate-900">
          Monthly Station Operating & Closure Roster — {monthlyRoster.monthName} {monthlyRoster.year}
        </h1>
        <p className="text-xs text-slate-600">
          Policy: {policy.closuresPerStation} Closures/Station/Week • Min Open Stations: {policy.minOpenStationsPerDay} • Generated on {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* Main Monthly Roster Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            {/* Header Structure */}
            <thead>
              {/* Row 1: Station Headers */}
              <tr className="bg-slate-900 text-white text-xs">
                <th className="p-3 w-32 sticky left-0 bg-slate-900 z-20 border-r border-slate-800 text-center font-bold">
                  DATE
                </th>
                <th className="p-3 w-28 sticky left-32 bg-slate-900 z-20 border-r border-slate-800 text-center font-bold">
                  DAY
                </th>
                {visibleStations.map((st) => (
                  <th
                    key={st.id}
                    colSpan={2}
                    className="p-3 text-center border-r border-slate-800 last:border-r-0 min-w-[240px]"
                  >
                    <div className="font-bold text-sm tracking-wide text-white">{st.name}</div>
                    <div className="text-[10px] text-indigo-200 font-normal mt-0.5 flex items-center justify-center gap-2">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {st.workingHours || '08:00 - 17:00'}
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <Coffee className="w-3 h-3" />
                        {st.breakTime || '13:00 - 14:00'}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>

              {/* Row 2: Sub-headers (Status / Assigned Staff) */}
              <tr className="bg-slate-100 text-slate-700 text-[11px] font-semibold border-b border-slate-200">
                <th className="p-2 text-center sticky left-0 bg-slate-100 z-20 border-r border-slate-200">
                  DD-Mon
                </th>
                <th className="p-2 text-center sticky left-32 bg-slate-100 z-20 border-r border-slate-200">
                  Weekday
                </th>
                {visibleStations.map((st) => (
                  <React.Fragment key={st.id}>
                    <th className="p-2 text-center w-24 border-r border-slate-200">STATUS</th>
                    <th className="p-2 text-left min-w-[160px] border-r border-slate-200 last:border-r-0">
                      ASSIGNED PERSONNEL
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>

            {/* Calendar Days Rows */}
            <tbody className="divide-y divide-slate-200 text-xs">
              {monthlyRoster.days.map((day) => {
                const isFilteredOut =
                  searchQuery.trim().length > 0 &&
                  !visibleStations.some((st) => {
                    const stStatus = day.stations[st.id];
                    return (
                      stStatus?.assignedMembers.some((m) =>
                        m.name.toLowerCase().includes(searchQuery.toLowerCase())
                      ) ||
                      st.name.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                  });

                if (isFilteredOut) return null;

                return (
                  <tr
                    key={day.date}
                    className={`transition-colors hover:bg-slate-50/70 ${
                      day.isWeekend ? 'bg-orange-50/30' : ''
                    }`}
                  >
                    {/* Date Column */}
                    <td
                      className={`p-2.5 text-center font-bold sticky left-0 z-10 border-r border-slate-200 ${
                        day.isWeekend
                          ? 'bg-amber-50 text-amber-900 font-extrabold'
                          : 'bg-white text-slate-800'
                      }`}
                    >
                      {day.formattedDate.split('-').slice(0, 2).join('-')}
                    </td>

                    {/* Weekday Column */}
                    <td
                      className={`p-2.5 text-center font-medium sticky left-32 z-10 border-r border-slate-200 ${
                        day.isWeekend
                          ? 'bg-amber-50 text-amber-800 font-bold'
                          : 'bg-white text-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>{day.weekday}</span>
                        {day.isWeekend && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-200/70 text-amber-900 font-bold">
                            W/E
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Station Columns */}
                    {visibleStations.map((st) => {
                      const stStatus = day.stations[st.id];
                      const isClosed = stStatus?.isClosed ?? false;
                      const assigned = stStatus?.assignedMembers ?? [];

                      return (
                        <React.Fragment key={st.id}>
                          {/* Status Cell */}
                          <td
                            className={`p-2.5 text-center font-bold border-r border-slate-200 ${
                              isClosed
                                ? 'bg-amber-100 text-amber-900 border-amber-200'
                                : 'bg-emerald-50 text-emerald-900 border-emerald-100'
                            }`}
                          >
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                isClosed
                                  ? 'bg-amber-200/80 text-amber-900 border border-amber-300'
                                  : 'bg-emerald-200/80 text-emerald-900 border border-emerald-300'
                              }`}
                            >
                              {isClosed ? 'CLOSED' : 'OPEN'}
                            </span>
                          </td>

                          {/* Members Cell */}
                          <td
                            className={`p-2.5 text-left border-r border-slate-200 last:border-r-0 ${
                              isClosed
                                ? 'bg-amber-50/70 text-amber-900'
                                : 'bg-emerald-50/30 text-slate-800'
                            }`}
                          >
                            {isClosed ? (
                              <div className="text-[11px] font-medium text-amber-800 italic">
                                {assigned.length > 0
                                  ? `${assigned.map((m) => m.name).join(', ')} (Holiday Off)`
                                  : 'All Station Staff Off'}
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                {assigned.length > 0 ? (
                                  assigned.map((m) => (
                                    <div key={m.id} className="font-semibold text-slate-800 text-xs">
                                      • {m.name}
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-slate-400 italic text-[11px]">Unstaffed station</span>
                                )}
                              </div>
                            )}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>

            {/* Monthly Summary Footer */}
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300 text-xs">
                <td
                  colSpan={2}
                  className="p-3 sticky left-0 bg-slate-100 z-10 border-r border-slate-200 font-bold text-slate-800 text-center"
                >
                  MONTHLY OPERATING SUMMARY
                </td>
                {visibleStations.map((st) => {
                  let openCount = 0;
                  let closedCount = 0;

                  for (const d of monthlyRoster.days) {
                    if (d.stations[st.id]?.isClosed) {
                      closedCount++;
                    } else {
                      openCount++;
                    }
                  }

                  return (
                    <td
                      key={st.id}
                      colSpan={2}
                      className="p-3 text-center border-r border-slate-200 last:border-r-0 font-bold text-slate-900"
                    >
                      <span className="text-emerald-700">{openCount} Days Open</span>
                      <span className="text-slate-400 mx-2">/</span>
                      <span className="text-amber-700">{closedCount} Days Closed</span>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
