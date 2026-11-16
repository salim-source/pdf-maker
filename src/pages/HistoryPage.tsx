import React, { useMemo, useState } from 'react';
import { Copy, ScanLine, Search, Star, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  clearScanHistory,
  deleteScanHistoryItem,
  toggleScanFavorite,
} from '../services/storageService';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ScanResultSheet } from '../components/ScanResultSheet';
import type { ScanHistoryItem } from '../types';

type HistoryFilter = 'all' | 'qr' | 'barcode' | 'favorites';

export const HistoryPage: React.FC = () => {
  const { scans, refreshData, showToast } = useApp();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [selectedItem, setSelectedItem] = useState<ScanHistoryItem | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scans.filter((item) => {
      if (filter === 'qr' && item.kind !== 'qr') return false;
      if (filter === 'barcode' && item.kind !== 'barcode') return false;
      if (filter === 'favorites' && !item.favorite) return false;
      if (!q) return true;
      return (
        item.rawValue.toLowerCase().includes(q) ||
        item.parsed.displayTitle.toLowerCase().includes(q) ||
        item.format.toLowerCase().includes(q)
      );
    });
  }, [scans, query, filter]);

  const handleToggleFavorite = async (id: string) => {
    const updated = await toggleScanFavorite(id);
    await refreshData();
    if (updated && selectedItem?.id === id) setSelectedItem(updated);
  };

  const handleDelete = async (id: string) => {
    await deleteScanHistoryItem(id);
    await refreshData();
    if (selectedItem?.id === id) setSelectedItem(null);
    showToast('Scan item deleted', 'info');
  };

  const handleCopy = async (raw: string) => {
    try {
      await navigator.clipboard.writeText(raw);
      showToast('Copied to clipboard', 'success');
    } catch {
      showToast('Clipboard access unavailable', 'error');
    }
  };

  const handleClearAll = async () => {
    await clearScanHistory();
    await refreshData();
    setConfirmClearAll(false);
    showToast('All scan history cleared', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Controls Header */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-slate-800/90 dark:bg-[#0E1525] sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search scan content, title, or barcode format…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B14] dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-[#070B14]">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'qr', label: 'QR' },
                { id: 'barcode', label: 'Barcodes' },
                { id: 'favorites', label: 'Favorites' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`min-h-[36px] rounded-lg px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  filter === tab.id
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {scans.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmClearAll(true)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40 whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* History List */}
      <div className="rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800/90 dark:bg-[#0E1525]">
        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <ScanLine className="mx-auto h-9 w-9 text-slate-400" />
            <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
              {scans.length === 0 ? 'No scan history yet' : 'No matching scans'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {scans.length === 0
                ? 'Decoded QR codes and barcodes are stored privately on this device.'
                : 'Try adjusting your search term or category filter.'}
            </p>
            {scans.length === 0 && (
              <Link
                to="/scanner"
                className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <ScanLine className="h-4 w-4" />
                <span>Open QR Scanner</span>
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {filtered.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
              >
                <button
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate text-sm font-medium text-slate-900 dark:text-white">
                    {item.parsed.displayTitle}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                    {item.rawValue}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>{item.kind === 'qr' ? 'QR Code' : item.format}</span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{item.parsed.type}</span>
                    <span aria-hidden="true">·</span>
                    <span>{new Date(item.timestamp).toLocaleString()}</span>
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleFavorite(item.id)}
                    aria-label={item.favorite ? 'Remove favorite' : 'Add favorite'}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Star
                      className={`h-4 w-4 ${
                        item.favorite ? 'fill-amber-400 text-amber-400' : ''
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(item.rawValue)}
                    aria-label="Copy scanned value"
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    aria-label="Delete scan item"
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ScanResultSheet
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onToggleFavorite={handleToggleFavorite}
      />

      <ConfirmDialog
        open={confirmClearAll}
        title="Clear All Scan History?"
        description="This permanently removes all QR code and barcode scan entries stored on this device."
        confirmLabel="Clear History"
        tone="danger"
        onCancel={() => setConfirmClearAll(false)}
        onConfirm={handleClearAll}
      />
    </div>
  );
};
