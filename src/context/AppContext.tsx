import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type {
  GeneratedQrItem,
  PdfDocumentMeta,
  ScanHistoryItem,
  ThemeMode,
  UserPreferences,
} from '../types';
import {
  DEFAULT_PREFERENCES,
  listGeneratedQrs,
  listPdfDocuments,
  listScanHistory,
  loadPreferences,
  savePreferences,
} from '../services/storageService';

export interface ToastMessage {
  id: string;
  text: string;
  tone: 'info' | 'success' | 'error';
}

interface AppContextValue {
  preferences: UserPreferences;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
  updatePreferences: (patch: Partial<UserPreferences>) => void;
  pdfs: PdfDocumentMeta[];
  scans: ScanHistoryItem[];
  generatedQrs: GeneratedQrItem[];
  isLoadingData: boolean;
  refreshData: () => Promise<void>;
  showToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<UserPreferences>(() => loadPreferences());
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : true
  );
  const [pdfs, setPdfs] = useState<PdfDocumentMeta[]>([]);
  const [scans, setScans] = useState<ScanHistoryItem[]>([]);
  const [generatedQrs, setGeneratedQrs] = useState<GeneratedQrItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const resolvedTheme: 'light' | 'dark' =
    preferences.theme === 'system' ? (systemDark ? 'dark' : 'light') : preferences.theme;

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const isDark = resolvedTheme === 'dark';
    root.classList.toggle('dark', isDark);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', isDark ? '#070B14' : '#F7F9FC');
    }
  }, [resolvedTheme]);

  const updatePreferences = useCallback((patch: Partial<UserPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...patch };
      savePreferences(next);
      return next;
    });
  }, []);

  const setTheme = useCallback(
    (theme: ThemeMode) => {
      updatePreferences({ theme });
    },
    [updatePreferences]
  );

  const refreshData = useCallback(async () => {
    try {
      const [nextPdfs, nextScans, nextQrs] = await Promise.all([
        listPdfDocuments(),
        listScanHistory(),
        listGeneratedQrs(),
      ]);
      setPdfs(nextPdfs);
      setScans(nextScans);
      setGeneratedQrs(nextQrs);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const showToast = useCallback((text: string, tone: 'info' | 'success' | 'error' = 'info') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-2), { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3200);
  }, []);

  return (
    <AppContext.Provider
      value={{
        preferences: preferences || DEFAULT_PREFERENCES,
        resolvedTheme,
        setTheme,
        updatePreferences,
        pdfs,
        scans,
        generatedQrs,
        isLoadingData,
        refreshData,
        showToast,
      }}
    >
      {children}
      {/* Toast viewport */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-20 right-4 z-50 flex flex-col gap-2 lg:bottom-6 lg:right-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur-md transition-all ${
              toast.tone === 'error'
                ? 'border-red-500/30 bg-red-950/90 text-red-100'
                : toast.tone === 'success'
                ? 'border-emerald-500/30 bg-slate-900/95 text-emerald-300 dark:bg-[#111A2E]/95'
                : 'border-slate-200 bg-white/95 text-slate-900 dark:border-slate-700/80 dark:bg-[#111A2E]/95 dark:text-slate-100'
            }`}
          >
            <span>{toast.text}</span>
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
