import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Monitor,
  Moon,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { ThemeMode } from '../types';
import {
  clearAllLocalCache,
  clearAllPdfs,
  clearScanHistory,
  formatBytes,
  getStorageOverview,
} from '../services/storageService';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PWAInstallButton } from '../components/PWAInstallButton';

export const SettingsPage: React.FC = () => {
  const { preferences, setTheme, updatePreferences, refreshData, showToast } = useApp();
  const [storageStats, setStorageStats] = useState<{
    pdfCount: number;
    scanCount: number;
    qrCount: number;
    pdfTotalBytes: number;
    estimatedUsageBytes: number | null;
  } | null>(null);
  const [confirmClear, setConfirmClear] = useState<'history' | 'pdfs' | 'all' | null>(null);

  const loadStats = async () => {
    const stats = await getStorageOverview();
    setStorageStats(stats);
  };

  useEffect(() => {
    void loadStats();
  }, []);

  const handleClearAction = async () => {
    if (confirmClear === 'history') {
      await clearScanHistory();
      showToast('Scan history cleared', 'info');
    } else if (confirmClear === 'pdfs') {
      await clearAllPdfs();
      showToast('Cached PDF documents cleared', 'info');
    } else if (confirmClear === 'all') {
      await clearAllLocalCache();
      showToast('All local Scanify cache cleared', 'info');
    }
    setConfirmClear(null);
    await refreshData();
    await loadStats();
  };

  const themeOptions: { id: ThemeMode; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Appearance */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800/90 dark:bg-[#0E1525]">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Appearance</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Choose between navy dark mode, light mode, or follow your operating system preference.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {themeOptions.map((opt) => {
            const Icon = opt.icon;
            const active = preferences.theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTheme(opt.id)}
                className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'border-blue-600 bg-blue-600/10 text-blue-600 dark:border-blue-500 dark:bg-blue-500/15 dark:text-blue-400'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Scanner & Reader Preferences */}
      <section className="divide-y divide-slate-100 rounded-2xl border border-slate-200/90 bg-white dark:divide-slate-800/80 dark:border-slate-800/90 dark:bg-[#0E1525]">
        <div className="p-6">
          <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <Volume2 className="h-4 w-4 text-blue-500" />
            <h2>Feedback & Safety</h2>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-white">Scan Sound</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Play a subtle audio chime when a QR code or barcode is decoded.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={preferences.soundEnabled}
            onClick={() => updatePreferences({ soundEnabled: !preferences.soundEnabled })}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
              preferences.soundEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                preferences.soundEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-white">Vibration Feedback</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Trigger brief haptic feedback on supported mobile devices after scanning.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={preferences.vibrationEnabled}
            onClick={() => updatePreferences({ vibrationEnabled: !preferences.vibrationEnabled })}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
              preferences.vibrationEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                preferences.vibrationEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-white">
              Confirm Before Opening External URLs
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Always ask for explicit confirmation before opening scanned links in a new tab.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={preferences.confirmBeforeOpeningUrls}
            onClick={() =>
              updatePreferences({ confirmBeforeOpeningUrls: !preferences.confirmBeforeOpeningUrls })
            }
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
              preferences.confirmBeforeOpeningUrls
                ? 'bg-blue-600'
                : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                preferences.confirmBeforeOpeningUrls ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Cache & Local Storage */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800/90 dark:bg-[#0E1525]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <Database className="h-4 w-4 text-purple-500" />
            <h2>Local Cache & Storage</h2>
          </div>
          {storageStats && (
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {formatBytes(storageStats.pdfTotalBytes)} PDFs stored
            </span>
          )}
        </div>

        {storageStats && (
          <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl border border-slate-200/80 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#070B14]">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Documents</div>
              <div className="mt-1 font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white">
                {storageStats.pdfCount}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Scans</div>
              <div className="mt-1 font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white">
                {storageStats.scanCount}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Saved QRs</div>
              <div className="mt-1 font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white">
                {storageStats.qrCount}
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setConfirmClear('history')}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Trash2 className="h-4 w-4" />
            <span>Clear Scan History</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmClear('pdfs')}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Trash2 className="h-4 w-4" />
            <span>Clear Cached PDFs</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmClear('all')}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <Trash2 className="h-4 w-4" />
            <span>Clear All Cache</span>
          </button>
        </div>
      </section>

      {/* Privacy & About Scanify */}
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800/90 dark:bg-[#0E1525]">
          <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <h2>Privacy Architecture</h2>
          </div>
          <ul className="mt-4 space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>All PDF documents are parsed and rendered 100% locally in your browser.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>Files, scan history, and bookmarks never leave your device automatically.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>Camera access is requested only while actively scanning QR codes or barcodes.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>External URLs always require explicit user confirmation before opening.</span>
            </li>
          </ul>
        </section>

        <section className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800/90 dark:bg-[#0E1525]">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
              <Smartphone className="h-4 w-4 text-blue-500" />
              <h2>About Scanify</h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Scanify is a cross-platform PDF document reader, live QR/barcode scanner, and QR code generator designed for speed and local privacy across Web PWA and native Android Kotlin (Jetpack Compose, CameraX, ML Kit, Room).
            </p>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <PWAInstallButton />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Offline-ready Web PWA · Native Android source in /android
            </span>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirmClear !== null}
        title={
          confirmClear === 'history'
            ? 'Clear Scan History?'
            : confirmClear === 'pdfs'
            ? 'Remove Cached PDFs?'
            : 'Clear All Local Data?'
        }
        description={
          confirmClear === 'history'
            ? 'This permanently removes all saved QR and barcode scan records from this device.'
            : confirmClear === 'pdfs'
            ? 'This permanently deletes imported PDF files, bookmarks, and saved reading positions from browser storage.'
            : 'This permanently deletes all cached PDFs, scan history, and saved QR codes from IndexedDB.'
        }
        confirmLabel="Clear Data"
        tone="danger"
        onCancel={() => setConfirmClear(null)}
        onConfirm={handleClearAction}
      />
    </div>
  );
};
