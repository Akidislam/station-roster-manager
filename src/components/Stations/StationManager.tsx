import React, { useState } from 'react';
import { Member, Station, MAX_MEMBERS_PER_STATION } from '../../types';
import { ConfirmModal } from '../Common/ConfirmModal';
import {
  Building2,
  Users,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertTriangle,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';

interface StationManagerProps {
  stations: Station[];
  members: Member[];
  declaredTotalMembers: number;
  onUpdateStations: (stations: Station[]) => void;
  onUpdateMembers: (members: Member[]) => void;
  onUpdateDeclaredTotal: (total: number) => void;
  onOpenWizard?: () => void;
}

export const StationManager: React.FC<StationManagerProps> = ({
  stations,
  members,
  declaredTotalMembers,
  onUpdateStations,
  onUpdateMembers,
  onUpdateDeclaredTotal,
  onOpenWizard,
}) => {
  // New Station Form state
  const [newStationName, setNewStationName] = useState<string>('');
  const [isAddingStation, setIsAddingStation] = useState<boolean>(false);

  // Inline member inputs per station
  const [stationMemberInputs, setStationMemberInputs] = useState<Record<string, string>>({});

  // New Member Form state (modal / drawer)
  const [newMemberName, setNewMemberName] = useState<string>('');
  const [newMemberRole, setNewMemberRole] = useState<string>('Operator');
  const [newMemberStationId, setNewMemberStationId] = useState<string>('');
  const [isAddingMember, setIsAddingMember] = useState<boolean>(false);

  // Editing Station
  const [editingStationId, setEditingStationId] = useState<string | null>(null);
  const [editingStationName, setEditingStationName] = useState<string>('');
  const [editingStationHours, setEditingStationHours] = useState<string>('08:00 - 17:00');
  const [editingStationBreak, setEditingStationBreak] = useState<string>('13:00 - 14:00');

  // Editing Member
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingMemberName, setEditingMemberName] = useState<string>('');
  const [editingMemberRole, setEditingMemberRole] = useState<string>('');

  // Confirmation Modals
  const [deleteStationConfirm, setDeleteStationConfirm] = useState<Station | null>(null);
  const [deleteMemberConfirm, setDeleteMemberConfirm] = useState<Member | null>(null);

  // Error feedback
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Assigned vs unassigned counts
  const assignedMembers = members.filter((m) => m.stationId !== null);
  const unassignedMembers = members.filter((m) => m.stationId === null);
  const totalConfigured = members.length;

  // Station Actions
  const handleAddStation = () => {
    const trimmed = newStationName.trim();
    if (!trimmed) return;

    if (stations.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMessage(`A station named "${trimmed}" already exists.`);
      return;
    }

    const newStation: Station = {
      id: `station-${Date.now()}`,
      name: trimmed,
      createdAt: Date.now(),
    };

    onUpdateStations([...stations, newStation]);
    setNewStationName('');
    setIsAddingStation(false);
    setErrorMessage('');
  };

  const handleSaveRenameStation = (id: string) => {
    const trimmed = editingStationName.trim();
    if (!trimmed) return;

    if (stations.some((s) => s.id !== id && s.name.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMessage(`Another station is already named "${trimmed}".`);
      return;
    }

    onUpdateStations(
      stations.map((s) =>
        s.id === id
          ? {
              ...s,
              name: trimmed,
              workingHours: editingStationHours.trim() || '08:00 - 17:00',
              breakTime: editingStationBreak.trim() || '13:00 - 14:00',
            }
          : s
      )
    );
    setEditingStationId(null);
    setEditingStationName('');
    setErrorMessage('');
  };

  const handleConfirmDeleteStation = () => {
    if (!deleteStationConfirm) return;
    const sId = deleteStationConfirm.id;

    // Remove station, and unassign any members that belonged to it
    onUpdateStations(stations.filter((s) => s.id !== sId));
    onUpdateMembers(
      members.map((m) => (m.stationId === sId ? { ...m, stationId: null } : m))
    );
    setDeleteStationConfirm(null);
  };

  // Member Actions
  const handleAddMember = () => {
    const trimmed = newMemberName.trim();
    if (!trimmed) return;

    if (members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMessage(`A member named "${trimmed}" already exists.`);
      return;
    }

    // Critical station staffing rule: Maximum 3 members per station
    if (newMemberStationId) {
      const currentStationMembers = members.filter((m) => m.stationId === newMemberStationId);
      if (currentStationMembers.length >= MAX_MEMBERS_PER_STATION) {
        const targetStation = stations.find((s) => s.id === newMemberStationId);
        setErrorMessage(
          `Critical staffing rule: Station "${targetStation?.name || 'Selected station'}" already has the maximum of 3 members. Never allow a fourth member to be assigned to any station.`
        );
        return;
      }
    }

    const newMember: Member = {
      id: `m-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
      role: newMemberRole.trim() || 'Operator',
      stationId: newMemberStationId || null,
      createdAt: Date.now(),
    };

    onUpdateMembers([...members, newMember]);
    setNewMemberName('');
    setIsAddingMember(false);
    setErrorMessage('');
  };

  const handleAddMemberDirect = (stationId: string) => {
    const raw = (stationMemberInputs[stationId] || '').trim();
    if (!raw) return;

    // Critical station staffing rule: Maximum 3 members per station
    const currentMembers = members.filter((m) => m.stationId === stationId);
    if (currentMembers.length >= MAX_MEMBERS_PER_STATION) {
      const targetStation = stations.find((s) => s.id === stationId);
      setErrorMessage(
        `Critical staffing rule: Station "${targetStation?.name || 'this station'}" already has the maximum of 3 members. Never allow a fourth member to be assigned to any station.`
      );
      return;
    }

    // Check duplicates across ALL members
    if (members.some((m) => m.name.toLowerCase() === raw.toLowerCase())) {
      setErrorMessage(`Warning: A member named "${raw}" is already assigned. Duplicate member names are not permitted.`);
      return;
    }

    const newMember: Member = {
      id: `m-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: raw,
      role: 'Member',
      stationId,
      createdAt: Date.now(),
    };

    onUpdateMembers([...members, newMember]);
    setStationMemberInputs((prev) => ({ ...prev, [stationId]: '' }));
    setErrorMessage('');
  };

  const handleSaveEditMember = (id: string) => {
    const trimmed = editingMemberName.trim();
    if (!trimmed) return;

    if (members.some((m) => m.id !== id && m.name.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMessage(`Another member is already named "${trimmed}".`);
      return;
    }

    onUpdateMembers(
      members.map((m) =>
        m.id === id ? { ...m, name: trimmed, role: editingMemberRole } : m
      )
    );
    setEditingMemberId(null);
    setEditingMemberName('');
    setErrorMessage('');
  };

  const handleConfirmDeleteMember = () => {
    if (!deleteMemberConfirm) return;
    onUpdateMembers(members.filter((m) => m.id !== deleteMemberConfirm.id));
    setDeleteMemberConfirm(null);
  };

  const handleReassignMember = (memberId: string, stationId: string | null) => {
    if (stationId) {
      const currentStationMembers = members.filter(
        (m) => m.stationId === stationId && m.id !== memberId
      );
      if (currentStationMembers.length >= MAX_MEMBERS_PER_STATION) {
        const targetStation = stations.find((s) => s.id === stationId);
        setErrorMessage(
          `Cannot reassign member: Station "${targetStation?.name || 'Target station'}" is already at maximum capacity (3 of 3 members). A station can have at most 3 members.`
        );
        return;
      }
    }

    onUpdateMembers(
      members.map((m) => (m.id === memberId ? { ...m, stationId } : m))
    );
    setErrorMessage('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Manage Stations & Members</h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure stations, assign workforce personnel, and manage operational groups without losing historical rosters.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {onOpenWizard && (
            <button
              type="button"
              onClick={onOpenWizard}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 shadow-xs transition-colors"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Bulk Setup Screen</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setIsAddingStation(true);
              setIsAddingMember(false);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Station</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsAddingMember(true);
              setIsAddingStation(false);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {/* Discrepancy Warnings */}
      {totalConfigured !== declaredTotalMembers && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <span className="font-bold text-amber-900">Member Count Discrepancy</span>
            <p className="text-amber-800 mt-0.5">
              Configured member total ({totalConfigured}) does not match declared total ({declaredTotalMembers}).
            </p>
          </div>
          <button
            type="button"
            onClick={() => onUpdateDeclaredTotal(totalConfigured)}
            className="px-3 py-1 bg-amber-200/80 hover:bg-amber-300 text-amber-900 font-semibold text-xs rounded-lg transition-colors"
          >
            Sync Declared Count
          </button>
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage('')} className="text-rose-600 font-bold">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* New Station Modal / Inline Drawer */}
      {isAddingStation && (
        <div className="p-5 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-3">
          <div className="font-bold text-sm text-indigo-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span>Add New Station</span>
          </div>
          <div className="flex items-center gap-3 max-w-md">
            <input
              type="text"
              value={newStationName}
              onChange={(e) => setNewStationName(e.target.value)}
              placeholder="e.g. Station Echo or Line 5"
              className="flex-1 px-3 py-2 text-xs border border-indigo-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAddStation()}
            />
            <button
              type="button"
              onClick={handleAddStation}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 shadow-xs"
            >
              Save Station
            </button>
            <button
              type="button"
              onClick={() => setIsAddingStation(false)}
              className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* New Member Modal / Inline Drawer */}
      {isAddingMember && (
        <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
          <div className="font-bold text-sm text-emerald-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" />
            <span>Add New Workforce Member</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
            <input
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="Full Name"
              className="px-3 py-2 text-xs border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
              autoFocus
            />
            <input
              type="text"
              value={newMemberRole}
              onChange={(e) => setNewMemberRole(e.target.value)}
              placeholder="Role / Title (e.g. Operator)"
              className="px-3 py-2 text-xs border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
            />
            <select
              value={newMemberStationId}
              onChange={(e) => setNewMemberStationId(e.target.value)}
              className="px-3 py-2 text-xs border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
            >
              <option value="">Leave Unassigned (Pool)</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  Assign to {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleAddMember}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 shadow-xs"
            >
              Save Member
            </button>
            <button
              type="button"
              onClick={() => setIsAddingMember(false)}
              className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Unassigned Pool Card */}
      {unassignedMembers.length > 0 && (
        <div className="bg-amber-50/50 rounded-2xl border border-amber-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <UserX className="w-4 h-4 text-amber-600" />
              <span>Unassigned Member Pool ({unassignedMembers.length})</span>
            </div>
            <span className="text-[11px] text-amber-700">Assign members to stations to include in scheduled holidays</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {unassignedMembers.map((m) => (
              <div
                key={m.id}
                className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs flex items-center justify-between gap-2"
              >
                <div>
                  <div className="font-semibold text-xs text-slate-900">{m.name}</div>
                  <div className="text-[10px] text-slate-400">{m.role || 'Personnel'}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <select
                    onChange={(e) => handleReassignMember(m.id, e.target.value)}
                    defaultValue=""
                    className="text-[10px] bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-slate-700"
                  >
                    <option value="" disabled>Assign...</option>
                    {stations.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setDeleteMemberConfirm(m)}
                    className="p-1 text-slate-400 hover:text-rose-600"
                    title="Delete member"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stations.map((st) => {
          const assignedToThis = members.filter((m) => m.stationId === st.id);
          const isEditingStation = editingStationId === st.id;

          return (
            <div
              key={st.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4"
            >
              {/* Header */}
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  {isEditingStation ? (
                    <div className="flex flex-col gap-2 flex-1 mr-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingStationName}
                          onChange={(e) => setEditingStationName(e.target.value)}
                          className="px-2 py-1 text-xs border border-indigo-400 rounded-lg w-full font-semibold"
                          placeholder="Station Name"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveRenameStation(st.id)}
                          className="p-1 bg-emerald-600 text-white rounded-md shrink-0"
                          title="Save station"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingStationId(null)}
                          className="p-1 text-slate-400 hover:text-slate-600 shrink-0"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-[10px]">
                        <div className="flex-1">
                          <label className="text-slate-500 font-medium">Hours:</label>
                          <input
                            type="text"
                            value={editingStationHours}
                            onChange={(e) => setEditingStationHours(e.target.value)}
                            placeholder="08:00 - 17:00"
                            className="px-1.5 py-0.5 border border-slate-300 rounded w-full"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-slate-500 font-medium">Break:</label>
                          <input
                            type="text"
                            value={editingStationBreak}
                            onChange={(e) => setEditingStationBreak(e.target.value)}
                            placeholder="13:00 - 14:00"
                            className="px-1.5 py-0.5 border border-slate-300 rounded w-full"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                        <h3 className="font-bold text-base text-slate-900">{st.name}</h3>
                        <button
                          onClick={() => {
                            setEditingStationId(st.id);
                            setEditingStationName(st.name);
                            setEditingStationHours(st.workingHours || '08:00 - 17:00');
                            setEditingStationBreak(st.breakTime || '13:00 - 14:00');
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                          title="Edit station details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 font-normal">
                        <span>Hours: {st.workingHours || '08:00 - 17:00'}</span>
                        <span>•</span>
                        <span>Break: {st.breakTime || '13:00 - 14:00'}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 font-bold text-xs rounded-full border ${
                        assignedToThis.length >= MAX_MEMBERS_PER_STATION
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                      }`}
                    >
                      {assignedToThis.length} / {MAX_MEMBERS_PER_STATION} Members
                      {assignedToThis.length >= MAX_MEMBERS_PER_STATION ? ' (Full)' : ''}
                    </span>
                    <button
                      onClick={() => setDeleteStationConfirm(st)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Delete station"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Member List for this station */}
                <div className="mt-4 space-y-2 max-h-56 overflow-y-auto pr-1">
                  {assignedToThis.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400 italic bg-slate-50 rounded-xl">
                      No members assigned to this station.
                    </div>
                  ) : (
                    assignedToThis.map((m) => {
                      const isEditingM = editingMemberId === m.id;
                      return (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/70 rounded-xl text-xs transition-colors"
                        >
                          {isEditingM ? (
                            <div className="flex items-center gap-2 flex-1 mr-2">
                              <input
                                type="text"
                                value={editingMemberName}
                                onChange={(e) => setEditingMemberName(e.target.value)}
                                className="px-2 py-1 text-xs border border-indigo-400 rounded-md bg-white flex-1"
                                placeholder="Member name"
                              />
                              <input
                                type="text"
                                value={editingMemberRole}
                                onChange={(e) => setEditingMemberRole(e.target.value)}
                                className="px-2 py-1 text-xs border border-indigo-400 rounded-md bg-white w-24"
                                placeholder="Role"
                              />
                              <button
                                onClick={() => handleSaveEditMember(m.id)}
                                className="p-1 bg-emerald-600 text-white rounded-md"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div>
                              <div className="font-semibold text-slate-800">{m.name}</div>
                              <div className="text-[10px] text-slate-400">{m.role || 'Member'}</div>
                            </div>
                          )}

                          {!isEditingM && (
                            <div className="flex items-center gap-1.5">
                              {/* Reassign dropdown */}
                              <select
                                value={m.stationId || ''}
                                onChange={(e) => handleReassignMember(m.id, e.target.value || null)}
                                className="text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-600"
                              >
                                <option value="">Pool</option>
                                {stations.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>

                              <button
                                onClick={() => {
                                  setEditingMemberId(m.id);
                                  setEditingMemberName(m.name);
                                  setEditingMemberRole(m.role || '');
                                }}
                                className="p-1 text-slate-400 hover:text-indigo-600"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => setDeleteMemberConfirm(m)}
                                className="p-1 text-slate-400 hover:text-rose-600"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Inline Add Member to this Station or Capacity Banner */}
                {assignedToThis.length >= MAX_MEMBERS_PER_STATION ? (
                  <div className="pt-3 border-t border-slate-100 p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Maximum capacity reached ({MAX_MEMBERS_PER_STATION} of {MAX_MEMBERS_PER_STATION} members).</span>
                    </div>
                    <span className="text-[11px] text-amber-700 font-semibold">Station full</span>
                  </div>
                ) : (
                  <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                    <input
                      type="text"
                      value={stationMemberInputs[st.id] || ''}
                      onChange={(e) =>
                        setStationMemberInputs((prev) => ({
                          ...prev,
                          [st.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddMemberDirect(st.id);
                        }
                      }}
                      placeholder={`Add member (${assignedToThis.length + 1} of ${MAX_MEMBERS_PER_STATION})...`}
                      className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:border-indigo-600 focus:bg-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddMemberDirect(st.id)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>

              {/* Station Quick Note */}
              <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                All {assignedToThis.length} member{assignedToThis.length !== 1 ? 's' : ''} assigned here will receive holidays simultaneously when {st.name} is closed.
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Station Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteStationConfirm)}
        title={`Delete ${deleteStationConfirm?.name}?`}
        message={`Are you sure you want to delete ${deleteStationConfirm?.name}? Any assigned team members will not be deleted, but will be moved to the unassigned pool. Historical rosters will remain preserved.`}
        confirmLabel="Delete Station"
        isDestructive={true}
        onConfirm={handleConfirmDeleteStation}
        onCancel={() => setDeleteStationConfirm(null)}
      />

      {/* Delete Member Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteMemberConfirm)}
        title={`Delete Member ${deleteMemberConfirm?.name}?`}
        message={`Are you sure you want to permanently delete ${deleteMemberConfirm?.name}? This action cannot be undone.`}
        confirmLabel="Delete Member"
        isDestructive={true}
        onConfirm={handleConfirmDeleteMember}
        onCancel={() => setDeleteMemberConfirm(null)}
      />
    </div>
  );
};
