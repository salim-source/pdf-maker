import React, { useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  FileText,
  FolderOpen,
  History,
  Home,
  QrCode,
  ScanLine,
  Settings,
  Upload,
} from 'lucide-react';
import { ScanifyLogo } from './ScanifyLogo';
import { OfflineIndicator, PWAInstallButton } from './PWAInstallButton';
import { importPdfFile } from '../services/pdfService';
import { useApp } from '../context/AppContext';

const SIDEBAR_ITEMS = [
  { to: '/', label: 'Dashboard', icon: Home, end: true },
  { to: '/reader', label: 'PDF Reader', icon: BookOpen },
  { to: '/scanner', label: 'QR Scanner', icon: ScanLine },
  { to: '/generator', label: 'QR Generator', icon: QrCode },
  { to: '/documents', label: 'PDF Manager', icon: FolderOpen },
  { to: '/history', label: 'Scan History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const MOBILE_TABS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/reader', label: 'Reader', icon: BookOpen },
  { to: '/scanner', label: 'Scan', icon: ScanLine },
  { to: '/generator', label: 'Create', icon: QrCode },
  { to: '/documents', label: 'Library', icon: FolderOpen },
];

function getRouteMeta(pathname: string): { title: string; primaryAction: 'pdf' | 'scan' } {
  if (pathname.startsWith('/reader')) return { title: 'PDF Reader', primaryAction: 'pdf' };
  if (pathname.startsWith('/scanner')) return { title: 'QR & Barcode Scanner', primaryAction: 'pdf' };
  if (pathname.startsWith('/generator')) return { title: 'QR Generator', primaryAction: 'scan' };
  if (pathname.startsWith('/documents')) return { title: 'PDF Manager', primaryAction: 'pdf' };
  if (pathname.startsWith('/history')) return { title: 'Scan History', primaryAction: 'scan' };
  if (pathname.startsWith('/settings')) return { title: 'Settings', primaryAction: 'pdf' };
  return { title: 'Dashboard', primaryAction: 'pdf' };
}

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshData, showToast } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { title, primaryAction } = getRouteMeta(location.pathname);

  const handleQuickPdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const meta = await importPdfFile(file);
      await refreshData();
      showToast(`Imported "${meta.name}"`, 'success');
      navigate(`/reader/${meta.id}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to import PDF', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-slate-900 dark:bg-[#070B14] dark:text-slate-100">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleQuickPdfImport}
      />

      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-800/80 dark:bg-[#0B1120]/95 lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200/80 px-5 dark:border-slate-800/80">
          <ScanifyLogo className="h-8 w-8 shrink-0" />
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
            Scanify
          </span>
        </div>

        <nav aria-label="Primary navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex min-h-[44px] items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
                  }`
                }
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-slate-200/80 p-4 dark:border-slate-800/80">
          <PWAInstallButton compact />
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <FileText className="h-3.5 w-3.5 shrink-0 text-blue-500" />
            <span>Local-only device processing</span>
          </div>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex min-h-screen flex-col lg:pl-[248px]">
        {/* Desktop & Mobile Top Header */}
        <header className="sticky top-0 z-20 flex h-13 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-md dark:border-slate-800/80 dark:bg-[#070B14]/85 lg:h-16 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex items-center gap-2.5 lg:hidden">
              <ScanifyLogo className="h-7 w-7 shrink-0" />
            </div>
            <h1 className="truncate font-display text-base font-semibold tracking-tight text-slate-900 dark:text-white lg:text-lg">
              {title}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <NavLink
              to="/history"
              aria-label="Scan History"
              className={({ isActive }) =>
                `flex h-10 w-10 items-center justify-center rounded-xl transition-colors lg:hidden ${
                  isActive
                    ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`
              }
            >
              <History className="h-5 w-5" />
            </NavLink>
            <NavLink
              to="/settings"
              aria-label="Settings"
              className={({ isActive }) =>
                `flex h-10 w-10 items-center justify-center rounded-xl transition-colors lg:hidden ${
                  isActive
                    ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`
              }
            >
              <Settings className="h-5 w-5" />
            </NavLink>

            {primaryAction === 'pdf' ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0 lg:px-4 lg:text-sm"
              >
                <Upload className="h-4 w-4" />
                <span>Import PDF</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/scanner')}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0 lg:px-4 lg:text-sm"
              >
                <ScanLine className="h-4 w-4" />
                <span>Scan QR</span>
              </button>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:py-7 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation (<= 60px, total sticky <= 15% viewport height) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-30 grid h-[60px] grid-cols-5 border-t border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-slate-800/80 dark:bg-[#0B1120]/95 lg:hidden"
      >
        {MOBILE_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 transition-colors ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium tracking-tight">{tab.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <OfflineIndicator />
    </div>
  );
};
