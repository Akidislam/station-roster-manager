import React, { useState } from 'react';
import { Member, Station, ClosurePolicy, MAX_MEMBERS_PER_STATION } from '../../types';
import { createDefaultPolicy, getDefaultMinOpenStations } from '../../utils/scheduler';
import {
  Building2,
  Users,
  Plus,
  Trash2,
  Edit2,
  Check,
  ArrowRight,
  AlertTriangle,
  UserPlus,
  Sparkles,
  Save,
  HelpCircle,
  X,
} from 'lucide-react';

interface SetupWizardProps {
  onComplete: (data: {
    stations: Station[];
    members: Member[];
    declaredTotalMembers: number;
    policy: ClosurePolicy;
  }) => void;
  onCancel?: () => void;
  initialStations?: Station[];
  initialMembers?: Member[];
}

interface StationDraft {
  id: string;
  name: string;
  members: { id: string; name: string }[];
}

export const SetupWizard: React.FC<SetupWizardProps> = ({
  onComplete,
  onCancel,
  initialStations = [],
  initialMembers = [],
}) => {
  // Step 1: "count" (How many stations do you have?), Step 2: "details" (Name stations and add members)
  const [setupStep, setSetupStep] = useState<'count' | 'details'>(
    initialStations.length > 0 ? 'details' : 'count'
  );

  const [stationCountInput, setStationCountInput] = useState<number>(
    initialStations.length > 0 ? initialStations.length : 3
  );

  // Station drafts with their member lists
  const [stationDrafts, setStationDrafts] = useState<StationDraft[]>(() => {
    if (initialStations.length > 0) {
      return initialStations.map((st) => ({
        id: st.id,
        name: st.name,
        members: initialMembers
          .filter((m) => m.stationId === st.id)
          .map((m) => ({ id: m.id, name: m.name })),
      }));
    }
    return [];
  });

  // Inputs for adding new members per station
  const [newMemberInputs, setNewMemberInputs] = useState<Record<string, string>>({});

  // Inline editing member state
  const [editingMember, setEditingMember] = useState<{
    stationId: string;
    memberId: string;
    name: string;
  } | null>(null);

  // Errors
  const [warningMessage, setWarningMessage] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');

  // Step 1: Confirm station count and create editable station forms
  const handleConfirmCount = () => {
    if (stationCountInput < 1) {
      setValidationError('Please enter at least 1 station.');
      return;
    }

    setValidationError('');
    setWarningMessage('');

    // Create that number of station forms with empty members
    const newDrafts: StationDraft[] = [];
    for (let i = 1; i <= stationCountInput; i++) {
      newDrafts.push({
        id: `station-${Date.now()}-${i}`,
        name: '', // Blank name so manager enters it manually
        members: [], // Strictly empty! No auto-generated members!
      });
    }

    setStationDrafts(newDrafts);
    setSetupStep('details');
  };

  // Add another station form
  const handleAddAnotherStation = () => {
    setStationDrafts((prev) => [
      ...prev,
      {
        id: `station-${Date.now()}-${prev.length + 1}`,
        name: '',
        members: [],
      },
    ]);
  };

  // Remove a station form
  const handleRemoveStation = (stationId: string) => {
    if (stationDrafts.length <= 1) {
      setValidationError('You must have at least one station.');
      return;
    }
    setStationDrafts((prev) => prev.filter((s) => s.id !== stationId));
  };

  // Station name change
  const handleStationNameChange = (stationId: string, newName: string) => {
    setValidationError('');
    setStationDrafts((prev) =>
      prev.map((s) => (s.id === stationId ? { ...s, name: newName } : s))
    );
  };

  // Add member to a specific station
  const handleAddMember = (stationId: string) => {
    const inputVal = (newMemberInputs[stationId] || '').trim();
    if (!inputVal) return;

    // Critical station staffing rule: Maximum 3 members per station
    const targetStation = stationDrafts.find((s) => s.id === stationId);
    if (targetStation && targetStation.members.length >= MAX_MEMBERS_PER_STATION) {
      setWarningMessage(
        `Critical staffing rule: Station "${targetStation.name.trim() || 'this station'}" already has the maximum of 3 members. Never allow a fourth member to be assigned to any station.`
      );
      return;
    }

    // Duplicate check across ALL stations
    for (const draft of stationDrafts) {
      const found = draft.members.find(
        (m) => m.name.trim().toLowerCase() === inputVal.toLowerCase()
      );
      if (found) {
        setWarningMessage(
          `Warning: A member named "${inputVal}" is already assigned to ${
            draft.name.trim() || 'another station'
          }. Duplicate member names are not permitted.`
        );
        return;
      }
    }

    setWarningMessage('');
    setValidationError('');

    const newMemberId = `m-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    setStationDrafts((prev) =>
      prev.map((s) => {
        if (s.id === stationId) {
          return {
            ...s,
            members: [...s.members, { id: newMemberId, name: inputVal }],
          };
        }
        return s;
      })
    );

    // Clear input for this station
    setNewMemberInputs((prev) => ({ ...prev, [stationId]: '' }));
  };

  // Remove member from station
  const handleRemoveMember = (stationId: string, memberId: string) => {
    setStationDrafts((prev) =>
      prev.map((s) => {
        if (s.id === stationId) {
          return {
            ...s,
            members: s.members.filter((m) => m.id !== memberId),
          };
        }
        return s;
      })
    );
  };

  // Save edit of member name
  const handleSaveEditMember = () => {
    if (!editingMember) return;
    const trimmed = editingMember.name.trim();
    if (!trimmed) return;

    // Check duplicate among other members
    for (const draft of stationDrafts) {
      const found = draft.members.find(
        (m) =>
          m.id !== editingMember.memberId &&
          m.name.trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (found) {
        setWarningMessage(
          `Warning: A member named "${trimmed}" already exists in ${
            draft.name.trim() || 'another station'
          }.`
        );
        return;
      }
    }

    setWarningMessage('');
    setStationDrafts((prev) =>
      prev.map((s) => {
        if (s.id === editingMember.stationId) {
          return {
            ...s,
            members: s.members.map((m) =>
              m.id === editingMember.memberId ? { ...m, name: trimmed } : m
            ),
          };
        }
        return s;
      })
    );
    setEditingMember(null);
  };

  // Save Station Setup
  const handleSaveStationSetup = () => {
    // 1. Validate that every station has a name
    for (let i = 0; i < stationDrafts.length; i++) {
      const st = stationDrafts[i];
      if (!st.name.trim()) {
        setValidationError(
          `Station ${i + 1} does not have a name. Please enter a name for every station before saving.`
        );
        return;
      }
    }

    // 2. Check for duplicate station names
    const namesSeen = new Set<string>();
    for (const st of stationDrafts) {
      const lower = st.name.trim().toLowerCase();
      if (namesSeen.has(lower)) {
        setValidationError(`Duplicate station name found: "${st.name.trim()}". Every station must have a unique name.`);
        return;
      }
      namesSeen.add(lower);
    }

    // 3. Validate station capacities: maximum 3 members per station
    for (const st of stationDrafts) {
      if (st.members.length > MAX_MEMBERS_PER_STATION) {
        setValidationError(
          `Station "${st.name.trim()}" has ${st.members.length} members. Critical rule: Each station can have a maximum of 3 members (0, 1, 2, or 3). Never allow a fourth member to be assigned to any station.`
        );
        return;
      }
    }

    // 4. Assemble clean models
    const colors = ['indigo', 'emerald', 'amber', 'purple', 'rose', 'cyan', 'blue', 'teal'];
    const stations: Station[] = stationDrafts.map((draft, idx) => ({
      id: draft.id,
      name: draft.name.trim(),
      color: colors[idx % colors.length],
      workingHours: '08:00 - 17:00',
      breakTime: '13:00 - 14:00',
      createdAt: Date.now() + idx,
    }));

    const members: Member[] = [];
    stationDrafts.forEach((draft) => {
      draft.members.forEach((m, mIdx) => {
        members.push({
          id: m.id,
          name: m.name.trim(),
          role: 'Member',
          stationId: draft.id,
          createdAt: Date.now() + mIdx,
        });
      });
    });

    const policy = createDefaultPolicy(stations.length);

    onComplete({
      stations,
      members,
      declaredTotalMembers: members.length,
      policy,
    });
  };

  const totalMembersCount = stationDrafts.reduce((acc, s) => acc + s.members.length, 0);

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Top Banner Header */}
      <div className="bg-slate-900 text-white p-6 border-b border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Station & Member Setup</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure your stations and manually assign team members.
              </p>
            </div>
          </div>

          {setupStep === 'details' && (
            <div className="flex items-center gap-3 text-xs bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700">
              <div>
                Stations: <strong className="text-indigo-400">{stationDrafts.length}</strong>
              </div>
              <div className="text-slate-600">|</div>
              <div>
                Total Members: <strong className="text-emerald-400">{totalMembersCount}</strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Screen 1: "How many stations do you have?" */}
      {setupStep === 'count' && (
        <div className="p-8 sm:p-12 space-y-8 animate-in fade-in duration-200">
          <div className="text-center max-w-md mx-auto space-y-3">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-xs">
              <Building2 className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900">How many stations do you have?</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Enter the total number of physical stations or work units you manage. You will manually name each station and add its team members in the next step.
            </p>
          </div>

          {/* Quick preset chips */}
          <div className="flex items-center justify-center gap-3 max-w-sm mx-auto">
            {[3, 4, 5].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setStationCountInput(preset)}
                className={`flex-1 py-2.5 px-3 rounded-xl border text-center transition-all ${
                  stationCountInput === preset
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold shadow-xs'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="text-lg font-bold">{preset}</div>
                <div className="text-[11px] text-slate-500">Stations</div>
              </button>
            ))}
          </div>

          {/* Number Input */}
          <div className="max-w-xs mx-auto text-center space-y-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Or enter custom station count:
            </label>
            <input
              type="number"
              min={1}
              max={25}
              value={stationCountInput}
              onChange={(e) => setStationCountInput(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full text-center px-4 py-3 text-2xl font-bold border-2 border-slate-300 rounded-xl focus:border-indigo-600 focus:outline-none transition-colors"
              placeholder="e.g. 3"
              autoFocus
            />
          </div>

          {validationError && (
            <div className="max-w-md mx-auto p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-6 border-t border-slate-100 max-w-md mx-auto">
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={handleConfirmCount}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md transition-all ml-auto"
            >
              <span>Continue to Name Stations</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Screen 2: Manually Name Every Station and Assign Members */}
      {setupStep === 'details' && (
        <div className="p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
          {/* Header instructions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Enter Station Names & Add Members</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Each station can have any name (e.g. <em>Dhaka Station</em>, <em>Chattogram Station</em>). Members belong strictly to their assigned station.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddAnotherStation}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Another Station</span>
              </button>

              <button
                type="button"
                onClick={() => setSetupStep('count')}
                className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1.5"
              >
                Change Count
              </button>
            </div>
          </div>

          {/* Duplicate warning banner */}
          {warningMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{warningMessage}</div>
              <button
                type="button"
                onClick={() => setWarningMessage('')}
                className="text-rose-500 hover:text-rose-700 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Validation error banner */}
          {validationError && (
            <div className="p-3.5 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{validationError}</div>
              <button
                type="button"
                onClick={() => setValidationError('')}
                className="text-rose-500 hover:text-rose-700 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Station Forms Grid */}
          <div className="space-y-5">
            {stationDrafts.map((station, sIdx) => {
              const currentInput = newMemberInputs[station.id] || '';

              return (
                <div
                  key={station.id}
                  className="bg-slate-50/60 rounded-2xl border-2 border-slate-200 p-5 space-y-4 hover:border-slate-300 transition-all shadow-2xs"
                >
                  {/* Station Name Header & Input */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                          {sIdx + 1}
                        </span>
                        <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Station {sIdx + 1} Name <span className="text-rose-500">*</span>
                        </label>
                      </div>
                      <input
                        type="text"
                        value={station.name}
                        onChange={(e) => handleStationNameChange(station.id, e.target.value)}
                        placeholder={`e.g. ${sIdx === 0 ? 'Dhaka Station' : sIdx === 1 ? 'Chattogram Station' : 'Sylhet Station'}`}
                        className="w-full sm:max-w-md px-3.5 py-2 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${
                          station.members.length >= MAX_MEMBERS_PER_STATION
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                        }`}
                      >
                        {station.members.length} / {MAX_MEMBERS_PER_STATION} Members
                        {station.members.length >= MAX_MEMBERS_PER_STATION ? ' (Full)' : ''}
                      </span>
                      {stationDrafts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveStation(station.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                          title="Remove this station"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Members List for this station */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        <span>Members assigned to {station.name.trim() || `Station ${sIdx + 1}`}:</span>
                      </label>
                      <span className="text-[11px] text-slate-500">
                        (Holidays are shared by all members assigned here)
                      </span>
                    </div>

                    {station.members.length === 0 ? (
                      <div className="p-3 bg-white border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-400 italic">
                        No members added yet for this station. Enter a member name below to add one, or leave empty if unstaffed.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {station.members.map((m) => {
                          const isEditingThis =
                            editingMember?.stationId === station.id &&
                            editingMember?.memberId === m.id;

                          return (
                            <div
                              key={m.id}
                              className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs text-xs"
                            >
                              {isEditingThis ? (
                                <div className="flex items-center gap-1.5 flex-1 mr-1">
                                  <input
                                    type="text"
                                    value={editingMember.name}
                                    onChange={(e) =>
                                      setEditingMember({ ...editingMember, name: e.target.value })
                                    }
                                    className="px-2 py-0.5 text-xs border border-indigo-500 rounded bg-indigo-50/40 w-full focus:outline-none"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveEditMember();
                                      if (e.key === 'Escape') setEditingMember(null);
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={handleSaveEditMember}
                                    className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                                    title="Save"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingMember(null)}
                                    className="p-1 text-slate-400 hover:text-slate-600"
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="font-semibold text-slate-800 truncate mr-2">
                                    • {m.name}
                                  </span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditingMember({
                                          stationId: station.id,
                                          memberId: m.id,
                                          name: m.name,
                                        })
                                      }
                                      className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                                      title="Edit member name"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveMember(station.id, m.id)}
                                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                                      title="Remove member"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add Member input or Full Capacity Banner */}
                    {station.members.length >= MAX_MEMBERS_PER_STATION ? (
                      <div className="pt-2 p-3 bg-amber-50/80 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                        <div className="font-semibold flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Maximum capacity reached ({MAX_MEMBERS_PER_STATION} of {MAX_MEMBERS_PER_STATION} members).</span>
                        </div>
                        <span className="text-[11px] text-amber-700 font-medium">Remove a member to add another.</span>
                      </div>
                    ) : (
                      <div className="pt-2 flex items-center gap-2 max-w-md">
                        <input
                          type="text"
                          value={currentInput}
                          onChange={(e) =>
                            setNewMemberInputs((prev) => ({
                              ...prev,
                              [station.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddMember(station.id);
                            }
                          }}
                          placeholder={`Add member (${station.members.length + 1} of ${MAX_MEMBERS_PER_STATION})...`}
                          className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:border-indigo-600 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddMember(station.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors shrink-0"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Add Member</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Setup Completion Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6 border-t border-slate-200">
            <div className="text-xs text-slate-500">
              Total: <strong>{stationDrafts.length}</strong> stations • <strong>{totalMembersCount}</strong> members configured.
            </div>

            <div className="flex items-center gap-3">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
              )}

              <button
                type="button"
                onClick={handleSaveStationSetup}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Save Station Setup</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
