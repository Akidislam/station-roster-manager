import React from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  FileSpreadsheet,
  Building2,
  BarChart3,
  Sliders,
  Database,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';

export type NavigationTab = 'dashboard' | 'roster' | 'monthly' | 'stations' | 'reports';

interface NavbarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onOpenPolicy: () => void;
  onOpenBackup: () => void;
  onOpenWizard: () => void;
  isPolicyFeasible: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenPolicy,
  onOpenBackup,
  onOpenWizard,
  isPolicyFeasible,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navItems: { id: NavigationTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'roster', label: 'Weekly Roster', icon: <CalendarDays className="w-4 h-4" /> },
    { id: 'monthly', label: 'Monthly Roster', icon: <FileSpreadsheet className="w-4 h-4" /> },
    { id: 'stations', label: 'Stations & Team', icon: <Building2 className="w-4 h-4" /> },
    { id: 'reports', label: 'Reports & Audits', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-xs">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-base tracking-tight leading-tight">
                Station Roster Manager
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                Operational Scheduling Engine
              </div>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Action Controls */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={onOpenPolicy}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                isPolicyFeasible
                  ? 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  : 'border-rose-300 bg-rose-50 text-rose-700 animate-pulse'
              }`}
              title="Configure Weekly Closure Policy"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Policy Rules</span>
              {!isPolicyFeasible && (
                <span className="w-2 h-2 rounded-full bg-rose-500" />
              )}
            </button>

            <button
              onClick={onOpenBackup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl border border-slate-200 transition-colors"
              title="Backup & Restore Data"
            >
              <Database className="w-3.5 h-3.5 text-slate-500" />
              <span>Data & Backup</span>
            </button>

            <button
              onClick={onOpenWizard}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-colors"
              title="Restart Setup Wizard"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Setup Wizard</span>
            </button>
          </div>

          {/* Mobile hamburger menu button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
            <button
              onClick={() => {
                onOpenPolicy();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50"
            >
              <span className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5" />
                <span>Policy Rules</span>
              </span>
              {!isPolicyFeasible && <span className="text-rose-600 font-bold">Needs Attention</span>}
            </button>

            <button
              onClick={() => {
                onOpenBackup();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Data & Backup</span>
            </button>

            <button
              onClick={() => {
                onOpenWizard();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Setup Wizard</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
