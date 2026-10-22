import React, { useState } from 'react';
import { ClosurePolicy, SuggestedPolicy, Weekday, WEEKDAYS } from '../../types';
import { analyzeFeasibility } from '../../utils/scheduler';
import { X, Check, AlertOctagon, Lightbulb, ShieldAlert, ArrowRight, RefreshCw } from 'lucide-react';

interface PolicySettingsModalProps {
  isOpen: boolean;
  stationCount: number;
  currentPolicy: ClosurePolicy;
  onSave: (policy: ClosurePolicy) => void;
  onClose: () => void;
}

export const PolicySettingsModal: React.FC<PolicySettingsModalProps> = ({
  isOpen,
  stationCount,
  currentPolicy,
  onSave,
  onClose,
}) => {
  const [policyDraft, setPolicyDraft] = useState<ClosurePolicy>({
    allowedClosureDays: { ...currentPolicy.allowedClosureDays },
    closuresPerStation: currentPolicy.closuresPerStation,
    minOpenStationsPerDay: currentPolicy.minOpenStationsPerDay,
    maxClosuresPerDay: currentPolicy.maxClosuresPerDay,
  });

  const [selectedSuggestion, setSelectedSuggestion] = useState<SuggestedPolicy | null>(null);

  if (!isOpen) return null;

  const feasibility = analyzeFeasibility(stationCount, policyDraft);

  const toggleDay = (day: Weekday) => {
    setPolicyDraft((prev) => ({
      ...prev,
      allowedClosureDays: {
        ...prev.allowedClosureDays,
        [day]: !prev.allowedClosureDays[day],
      },
    }));
  };

  const handleMinOpenChange = (val: number) => {
    const minOpen = Math.max(1, Math.min(stationCount, val));
    setPolicyDraft((prev) => ({
      ...prev,
      minOpenStationsPerDay: minOpen,
    }));
  };

  const handleClosuresPerStationChange = (val: number) => {
    const closures = Math.max(1, Math.min(7, val));
    setPolicyDraft((prev) => ({
      ...prev,
      closuresPerStation: closures,
    }));
  };

  const applySuggestedPolicy = (suggestion: SuggestedPolicy) => {
    setPolicyDraft({
      allowedClosureDays: { ...suggestion.allowedClosureDays },
      closuresPerStation: suggestion.closuresPerStation,
      minOpenStationsPerDay: suggestion.minOpenStationsPerDay,
    });
    setSelectedSuggestion(suggestion);
  };

  const handleResetToDefault = () => {
    setPolicyDraft({
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
      minOpenStationsPerDay: stationCount <= 3 ? 1 : stationCount === 4 ? 2 : 3,
    });
  };

  const maxClosures = Math.max(0, stationCount - policyDraft.minOpenStationsPerDay);
  const eligibleDaysCount = WEEKDAYS.filter((d) => policyDraft.allowedClosureDays[d]).length;
  const totalRequired = stationCount * policyDraft.closuresPerStation;
  const totalCapacity = eligibleDaysCount * maxClosures;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Weekly Closure & Operating Policy</h2>
            <p className="text-xs text-slate-500 mt-1">
              Configure station holiday constraints for {stationCount} active station{stationCount > 1 ? 's' : ''}.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Mathematical Feasibility Banner */}
          <div
            className={`p-4 rounded-xl border ${
              feasibility.isFeasible
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-rose-50 border-rose-200 text-rose-950'
            }`}
          >
            <div className="flex items-start gap-3">
              {feasibility.isFeasible ? (
                <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-2 text-xs">
                <div className="font-semibold text-sm">
                  {feasibility.isFeasible ? 'Policy is Mathematically Feasible' : 'Mathematical Infeasibility Detected'}
                </div>
                <p className="leading-relaxed whitespace-pre-line">{feasibility.reason}</p>

                {feasibility.proof && (
                  <div className="mt-3 p-3 bg-white/80 rounded-lg border border-slate-200/60 text-slate-700 font-mono text-[11px] grid grid-cols-2 gap-2">
                    <div>Weekly slots required: <strong>{totalRequired}</strong></div>
                    <div>Weekly slots capacity: <strong>{totalCapacity}</strong></div>
                    <div>Eligible closure days: <strong>{eligibleDaysCount} of 7</strong></div>
                    <div>Daily max closures: <strong>{maxClosures}</strong></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Alternative Policy Suggestions */}
          {!feasibility.isFeasible && feasibility.suggestedPolicies && feasibility.suggestedPolicies.length > 0 && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
                <Lightbulb className="w-4 h-4 text-amber-600" />
                <span>Suggested Mathematically Feasible Policies</span>
              </div>
              <p className="text-xs text-amber-800 leading-normal">
                Review the suggestions below and click <strong>Apply Suggestion</strong> to update the draft settings:
              </p>

              <div className="space-y-2.5">
                {feasibility.suggestedPolicies.map((sug) => (
                  <div
                    key={sug.id}
                    className="p-3.5 bg-white rounded-lg border border-amber-200 shadow-xs hover:border-indigo-400 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                        <span>{sug.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">{sug.description}</p>
                      <div className="text-[10px] text-indigo-600 font-medium">
                        Capacity: {sug.maxCapacity} slots vs {sug.requiredCapacity} required • Min open: {sug.minOpenStationsPerDay}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => applySuggestedPolicy(sug)}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
                    >
                      <span>Apply Suggestion</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Setting 1: Weekday Closure Toggles */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">
              Allowed Closure Days (Monday – Sunday)
            </label>
            <p className="text-xs text-slate-500 mb-3">
              Toggle days where stations are allowed to be closed. When prohibited, all stations must remain open.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {WEEKDAYS.map((day) => {
                const isAllowed = policyDraft.allowedClosureDays[day];
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs font-medium transition-all ${
                      isAllowed
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <span>{day}</span>
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        isAllowed ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isAllowed ? 'Allowed' : 'Prohibited'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Setting 2 & 3: Numerical Constraints */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-800 uppercase tracking-wider mb-1">
                Required Closures per Station
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Number of days each station must close each week (default: 2).
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={policyDraft.closuresPerStation}
                  onChange={(e) => handleClosuresPerStationChange(parseInt(e.target.value) || 1)}
                  className="w-24 px-3 py-2 text-sm font-semibold border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <span className="text-xs text-slate-600">days/week</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 uppercase tracking-wider mb-1">
                Minimum Open Stations per Day
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Operational threshold that must remain open every day (1 to {stationCount}).
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={stationCount}
                  value={policyDraft.minOpenStationsPerDay}
                  onChange={(e) => handleMinOpenChange(parseInt(e.target.value) || 1)}
                  className="w-24 px-3 py-2 text-sm font-semibold border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <span className="text-xs text-slate-600">stations open</span>
              </div>
            </div>
          </div>

          {/* Derived Capacity Summary */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-900">Derived Max Closures/Day:</span>{' '}
              {maxClosures} station{maxClosures !== 1 ? 's' : ''} (Station count {stationCount} − Min open{' '}
              {policyDraft.minOpenStationsPerDay})
            </div>
            <button
              type="button"
              onClick={handleResetToDefault}
              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset Default</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 bg-slate-50 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Cancel
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                onSave(policyDraft);
                onClose();
              }}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Apply Policy Settings</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
