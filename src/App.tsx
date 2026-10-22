import React, { useState, useEffect } from 'react';
import { AppDataSchema, ClosurePolicy, Member, Station, WeekSchedule, Weekday } from './types';
import { loadAppData, saveAppData, getISOWeekInfo } from './utils/storage';
import { analyzeFeasibility, validateSchedule, generateOptimalRoster } from './utils/scheduler';
import { Navbar, NavigationTab } from './components/Navbar';
import { Dashboard } from './components/Dashboard/Dashboard';
import { WeeklyRosterView } from './components/Roster/WeeklyRosterView';
import { MonthlyRosterView } from './components/Monthly/MonthlyRosterView';
import { StationManager } from './components/Stations/StationManager';
import { ReportsView } from './components/Reports/ReportsView';
import { PolicySettingsModal } from './components/Policy/PolicySettingsModal';
import { DataBackupModal } from './components/DataManagement/DataBackupModal';
import { SetupWizard } from './components/Wizard/SetupWizard';

export default function App() {
  const [appData, setAppData] = useState<AppDataSchema>(() => loadAppData());
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');

  // Modals state
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState<boolean>(false);
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);

  // Sync to local storage whenever appData changes
  useEffect(() => {
    saveAppData(appData);
  }, [appData]);

  // Feasibility check
  const feasibility = analyzeFeasibility(appData.stations.length, appData.policy);

  // Handlers for Schedule updates
  const handleUpdateSchedule = (updatedSchedule: WeekSchedule) => {
    setAppData((prev) => {
      const isNowPublished = updatedSchedule.isPublished && updatedSchedule.isValid;
      return {
        ...prev,
        schedules: {
          ...prev.schedules,
          [updatedSchedule.weekId]: updatedSchedule,
        },
        latestPublishedWeekId: isNowPublished ? updatedSchedule.weekId : prev.latestPublishedWeekId,
        lastPublishedAt: isNowPublished ? updatedSchedule.lastModified : prev.lastPublishedAt,
      };
    });
  };

  // Handlers for Policy updates
  const handleSavePolicy = (newPolicy: ClosurePolicy) => {
    setAppData((prev) => {
      // Re-validate current schedules against new policy
      const updatedSchedules = { ...prev.schedules };
      const stationIds = prev.stations.map((s) => s.id);
      const stationNames = Object.fromEntries(prev.stations.map((s) => [s.id, s.name]));

      for (const [wId, sched] of Object.entries(updatedSchedules)) {
        if (sched.assignments) {
          const errors = validateSchedule(stationIds, stationNames, newPolicy, sched.assignments);
          const isValid = errors.length === 0;
          updatedSchedules[wId] = {
            ...sched,
            isValid,
            validationErrors: errors,
            isPublished: sched.isPublished && isValid, // Unpublish if now violating constraints
          };
        }
      }

      // Check if latestPublishedWeekId is still valid
      let nextPublishedWeekId = prev.latestPublishedWeekId;
      let nextPublishedAt = prev.lastPublishedAt;
      if (nextPublishedWeekId && (!updatedSchedules[nextPublishedWeekId] || !updatedSchedules[nextPublishedWeekId].isPublished)) {
        const remainingPublished = Object.values(updatedSchedules)
          .filter((s) => s.isPublished && s.isValid)
          .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
        nextPublishedWeekId = remainingPublished[0]?.weekId;
        nextPublishedAt = remainingPublished[0]?.lastModified;
      }

      return {
        ...prev,
        policy: newPolicy,
        schedules: updatedSchedules,
        latestPublishedWeekId: nextPublishedWeekId,
        lastPublishedAt: nextPublishedAt,
      };
    });
  };

  // Handlers for Station updates
  const handleUpdateStations = (newStations: Station[]) => {
    setAppData((prev) => {
      return {
        ...prev,
        stations: newStations,
      };
    });
  };

  // Handlers for Member updates
  const handleUpdateMembers = (newMembers: Member[]) => {
    setAppData((prev) => ({
      ...prev,
      members: newMembers,
    }));
  };

  const handleUpdateDeclaredTotal = (total: number) => {
    setAppData((prev) => ({
      ...prev,
      declaredTotalMembers: total,
    }));
  };

  // Restore complete state from backup or reset
  const handleRestoreData = (newData: AppDataSchema) => {
    setAppData(newData);
  };

  // Complete setup wizard
  const handleCompleteWizard = (wizardResult: {
    stations: Station[];
    members: Member[];
    declaredTotalMembers: number;
    policy: ClosurePolicy;
  }) => {
    // Generate initial schedule for the current week using the manually entered stations
    const stationIds = wizardResult.stations.map((s) => s.id);
    const stationNames = Object.fromEntries(wizardResult.stations.map((s) => [s.id, s.name]));
    const currentWeek = getISOWeekInfo();
    
    // Check feasibility and generate schedule
    const feas = analyzeFeasibility(stationIds.length, wizardResult.policy);
    let initialAssignments: Record<Weekday, Record<string, boolean>>;
    let isValid = false;
    let validationErrors: string[] = [];

    if (feas.isFeasible) {
      const rosterGen = generateOptimalRoster(stationIds, wizardResult.policy);
      initialAssignments = rosterGen.assignments;
      validationErrors = validateSchedule(stationIds, stationNames, wizardResult.policy, initialAssignments);
      isValid = validationErrors.length === 0;
    } else {
      initialAssignments = {
        Monday: {}, Tuesday: {}, Wednesday: {}, Thursday: {}, Friday: {}, Saturday: {}, Sunday: {}
      };
      for (const d of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const) {
        for (const sId of stationIds) {
          initialAssignments[d][sId] = false;
        }
      }
      validationErrors = [feas.reason];
    }

    const initialSchedule: WeekSchedule = {
      weekId: currentWeek.weekId,
      weekNumber: currentWeek.weekNumber,
      year: currentWeek.year,
      startDate: currentWeek.mondayDate,
      assignments: initialAssignments,
      isPublished: isValid,
      isValid,
      validationErrors,
      lastModified: Date.now(),
    };

    const freshData: AppDataSchema = {
      ...appData,
      stations: wizardResult.stations,
      members: wizardResult.members,
      declaredTotalMembers: wizardResult.declaredTotalMembers,
      policy: wizardResult.policy,
      schedules: {
        [currentWeek.weekId]: initialSchedule,
      },
      currentWeekId: currentWeek.weekId,
      latestPublishedWeekId: isValid ? currentWeek.weekId : undefined,
      lastPublishedAt: isValid ? initialSchedule.lastModified : undefined,
      isWizardCompleted: true,
      updatedAt: Date.now(),
    };

    setAppData(freshData);
    setIsWizardOpen(false);
    setActiveTab('dashboard'); // "After saving, open the main dashboard"
  };

  // If first time open (or no stations configured), render the Station Setup Screen directly as the First Screen!
  if (!appData.isWizardCompleted || appData.stations.length === 0) {
    return (
      <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
        <header className="bg-white border-b border-slate-200 py-4 px-6 shadow-xs">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-xs font-bold">
                SR
              </div>
              <div>
                <div className="font-bold text-slate-900 text-base leading-tight">Station Roster Manager</div>
                <div className="text-[11px] text-slate-500">First-Time Setup: Stations & Member Assignment</div>
              </div>
            </div>
            <button
              onClick={() => setIsBackupModalOpen(true)}
              className="text-xs text-slate-600 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100"
            >
              Restore from Backup
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
          <SetupWizard
            onComplete={handleCompleteWizard}
            initialStations={appData.stations}
            initialMembers={appData.members}
          />
        </main>

        <DataBackupModal
          isOpen={isBackupModalOpen}
          data={appData}
          onRestoreData={handleRestoreData}
          onClose={() => setIsBackupModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenPolicy={() => setIsPolicyModalOpen(true)}
        onOpenBackup={() => setIsBackupModalOpen(true)}
        onOpenWizard={() => setIsWizardOpen(true)}
        isPolicyFeasible={feasibility.isFeasible}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isWizardOpen ? (
          <SetupWizard
            initialStations={appData.stations}
            initialMembers={appData.members}
            onComplete={handleCompleteWizard}
            onCancel={() => setIsWizardOpen(false)}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard
                data={appData}
                onNavigate={setActiveTab}
                onOpenPolicy={() => setIsPolicyModalOpen(true)}
                onOpenWizard={() => setIsWizardOpen(true)}
              />
            )}

            {activeTab === 'roster' && (
              <WeeklyRosterView
                data={appData}
                onUpdateSchedule={handleUpdateSchedule}
                onOpenPolicy={() => setIsPolicyModalOpen(true)}
              />
            )}

            {activeTab === 'monthly' && (
              <MonthlyRosterView
                data={appData}
                onOpenPolicy={() => setIsPolicyModalOpen(true)}
                onUpdateStations={handleUpdateStations}
              />
            )}

            {activeTab === 'stations' && (
              <StationManager
                stations={appData.stations}
                members={appData.members}
                declaredTotalMembers={appData.declaredTotalMembers}
                onUpdateStations={handleUpdateStations}
                onUpdateMembers={handleUpdateMembers}
                onUpdateDeclaredTotal={handleUpdateDeclaredTotal}
                onOpenWizard={() => setIsWizardOpen(true)}
              />
            )}

            {activeTab === 'reports' && <ReportsView data={appData} />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 print:hidden mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <strong>Station Roster Manager</strong> — Station-based holiday & weekly operational scheduling
          </div>
          <div className="text-[11px] text-slate-400">
            Local browser storage active • Exact mathematical constraint engine
          </div>
        </div>
      </footer>

      {/* Policy Settings Modal */}
      <PolicySettingsModal
        isOpen={isPolicyModalOpen}
        stationCount={appData.stations.length}
        currentPolicy={appData.policy}
        onSave={handleSavePolicy}
        onClose={() => setIsPolicyModalOpen(false)}
      />

      {/* Data Backup & Persistence Modal */}
      <DataBackupModal
        isOpen={isBackupModalOpen}
        data={appData}
        onRestoreData={handleRestoreData}
        onClose={() => setIsBackupModalOpen(false)}
      />
    </div>
  );
}
