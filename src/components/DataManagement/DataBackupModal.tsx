import React, { useRef, useState } from 'react';
import { AppDataSchema } from '../../types';
import { validateImportedData, createInitialData, createSampleDemoData } from '../../utils/storage';
import { triggerFileDownload } from '../../utils/csvExport';
import { ConfirmModal } from '../Common/ConfirmModal';
import {
  Download,
  Upload,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  CheckCircle2,
  X,
  FileJson,
  Info,
  Sparkles,
} from 'lucide-react';

interface DataBackupModalProps {
  isOpen: boolean;
  data: AppDataSchema;
  onRestoreData: (newData: AppDataSchema) => void;
  onClose: () => void;
}

export const DataBackupModal: React.FC<DataBackupModalProps> = ({
  isOpen,
  data,
  onRestoreData,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string>('');
  const [importSuccess, setImportSuccess] = useState<string>('');
  const [pendingImportData, setPendingImportData] = useState<AppDataSchema | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [showDemoConfirm, setShowDemoConfirm] = useState<boolean>(false);

  if (!isOpen) return null;

  // Export JSON backup
  const handleExportBackup = () => {
    const jsonStr = JSON.stringify(data, null, 2);
    const dateStr = new Date().toISOString().split('T')[0];
    triggerFileDownload(jsonStr, `StationRoster_Backup_${dateStr}.json`, 'application/json');
  };

  // Handle file select for import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError('');
    setImportSuccess('');
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const validated = validateImportedData(parsed);

        if (!validated.valid || !validated.data) {
          setImportError(validated.error || 'Invalid backup file structure.');
          return;
        }

        // Stage for user confirmation before overwriting
        setPendingImportData(validated.data);
      } catch (err) {
        setImportError('Failed to parse file. Please upload a valid JSON backup file.');
      }
    };
    reader.onerror = () => {
      setImportError('Failed to read file from disk.');
    };
    reader.readAsText(file);

    // Reset file input value so same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Confirm import overwrite
  const handleConfirmImport = () => {
    if (!pendingImportData) return;
    onRestoreData(pendingImportData);
    setPendingImportData(null);
    setImportSuccess('Data successfully restored from backup file.');
  };

  // Reset to clean initial setup
  const handleConfirmReset = () => {
    const fresh = createInitialData();
    onRestoreData(fresh);
    setShowResetConfirm(false);
    onClose();
  };

  // Load sample demo data
  const handleConfirmLoadDemo = () => {
    const sample = createSampleDemoData();
    onRestoreData(sample);
    setShowDemoConfirm(false);
    setImportSuccess('Sample demo dataset loaded.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Data Persistence & Backups</h2>
              <p className="text-xs text-slate-500">
                Manage local browser storage, export backups, and restore datasets.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
          {/* Honest Storage Notice */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-slate-600 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Info className="w-4 h-4 text-indigo-600" />
              <span>Browser Local Storage Notice</span>
            </div>
            <p>
              In this version, all application data (stations, team members, policies, and schedules) is saved exclusively in your browser’s localStorage.
            </p>
            <p className="text-[11px] text-slate-500">
              Data is retained between browser sessions on this device. However, changes do not synchronize between different users or devices, and clearing your browser storage will remove data unless exported as a JSON backup below.
            </p>
          </div>

          {/* Feedback banners */}
          {importError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{importError}</span>
            </div>
          )}

          {importSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{importSuccess}</span>
            </div>
          )}

          {/* Export Section */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-4">
            <div>
              <div className="font-bold text-slate-900 text-sm">Export Full Application Backup</div>
              <p className="text-slate-500 mt-0.5">
                Download all stations, members, rules, and historical rosters as a JSON file.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportBackup}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-xs transition-colors shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Export JSON</span>
            </button>
          </div>

          {/* Import Section */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-4">
            <div>
              <div className="font-bold text-slate-900 text-sm">Restore from JSON Backup</div>
              <p className="text-slate-500 mt-0.5">
                Validate and load a previously exported JSON backup file.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold border border-slate-300 transition-colors shrink-0"
            >
              <Upload className="w-4 h-4" />
              <span>Import JSON</span>
            </button>
          </div>

          {/* Sample Demo Dataset */}
          <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl flex items-center justify-between gap-4">
            <div>
              <div className="font-bold text-indigo-900 text-sm">Load Sample Demo Dataset</div>
              <p className="text-indigo-700 mt-0.5">
                Loads a sample 3-station demo dataset (Dhaka, Chattogram, Sylhet) to test scheduling.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDemoConfirm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-xl font-semibold border border-indigo-300 transition-colors shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span>Load Demo</span>
            </button>
          </div>

          {/* Reset to Clean Setup */}
          <div className="p-4 bg-rose-50/50 border border-rose-200 rounded-xl flex items-center justify-between gap-4">
            <div>
              <div className="font-bold text-rose-900 text-sm">Reset & Start Setup Screen Fresh</div>
              <p className="text-rose-700 mt-0.5">
                Clears all current stations and returns to the initial Setup screen to start over.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-xl font-semibold border border-rose-300 transition-colors shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset State</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>

      {/* Confirmation before overwriting from import */}
      <ConfirmModal
        isOpen={Boolean(pendingImportData)}
        title="Confirm Backup Restoration"
        message={`Are you sure you want to restore data from this backup? It contains ${
          pendingImportData?.stations.length || 0
        } stations and ${
          pendingImportData?.members.length || 0
        } members. This will replace all current unexported changes.`}
        confirmLabel="Overwrite & Restore"
        isDestructive={true}
        onConfirm={handleConfirmImport}
        onCancel={() => setPendingImportData(null)}
      />

      {/* Confirmation before demo load */}
      <ConfirmModal
        isOpen={showDemoConfirm}
        title="Load Sample Demo Dataset?"
        message="This will overwrite current stations and members with sample stations (Dhaka, Chattogram, Sylhet). Be sure to export a backup if you have custom data you wish to keep."
        confirmLabel="Load Demo Data"
        isDestructive={false}
        onConfirm={handleConfirmLoadDemo}
        onCancel={() => setShowDemoConfirm(false)}
      />

      {/* Confirmation before reset */}
      <ConfirmModal
        isOpen={showResetConfirm}
        title="Reset Application to Initial Setup?"
        message="This will clear your existing stations and members, returning you to the initial Setup Screen to configure stations from scratch."
        confirmLabel="Reset Everything"
        isDestructive={true}
        onConfirm={handleConfirmReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
};
