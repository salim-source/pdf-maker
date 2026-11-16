import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  FileText,
  QrCode,
  ScanLine,
  Star,
  Upload,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { importPdfFile } from '../services/pdfService';
import { formatBytes, toggleScanFavorite, updatePdfMeta } from '../services/storageService';
import { ScanResultSheet } from '../components/ScanResultSheet';
import type { ScanHistoryItem } from '../types';

export const DashboardPage: React.FC = () => {
  const { pdfs, scans, generatedQrs, refreshData, showToast } = useApp();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedScan, setSelectedScan] = useState<ScanHistoryItem | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const favoriteCount =
    pdfs.filter((d) => d.favorite).length +
    scans.filter((s) => s.favorite).length;

  const recentPdfs = pdfs.slice(0, 4);
  const recentScans = scans.slice(0, 4);
  const favoritePdfs = pdfs.filter((d) => d.favorite).slice(0, 3);
  const favoriteScans = scans.filter((s) => s.favorite).slice(0, 3);

  const handleImportPdf = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const meta = await importPdfFile(file);
      await refreshData();
      showToast(`Imported "${meta.name}"`, 'success');
      navigate(`/reader/${meta.id}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to import PDF', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleTogglePdfFavorite = async (id: string, current: boolean) => {
    await updatePdfMeta(id, { favorite: !current });
    await refreshData();
  };

  const handleToggleScanFav = async (id: string) => {
    const updated = await toggleScanFavorite(id);
    await refreshData();
    if (updated && selectedScan?.id === id) {
      setSelectedScan(updated);
    }
  };

  return (
    <div className="space-y-8">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          void handleImportPdf(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Primary Workspace Shortcuts */}
      <section aria-label="Quick actions" className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800/90 dark:bg-[#0E1525]">
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
              <BookOpen className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
              PDF Reader
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Open local PDFs with text search, page bookmarks, pinch zoom, and automatic position resume.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={isImporting}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap"
            >
              <Upload className="h-4 w-4" />
              <span>{isImporting ? 'Importing…' : 'Open PDF'}</span>
            </button>
            <Link
              to="/reader"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <span>Workspace</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800/90 dark:bg-[#0E1525]">
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-600/10 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400">
              <ScanLine className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
              QR & Barcode Scanner
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Decode QR codes, barcodes, Wi-Fi networks, and contact cards directly via camera or image.
            </p>
          </div>
          <div className="mt-5">
            <Link
              to="/scanner"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 whitespace-nowrap"
            >
              <ScanLine className="h-4 w-4" />
              <span>Launch Scanner</span>
            </Link>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800/90 dark:bg-[#0E1525]">
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900/5 text-slate-800 dark:bg-slate-100/10 dark:text-slate-200">
              <QrCode className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
              QR Generator
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Create custom QR codes for URLs, Wi-Fi credentials, contacts, email, phone, and plain text.
            </p>
          </div>
          <div className="mt-5">
            <Link
              to="/generator"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <QrCode className="h-4 w-4" />
              <span>Create QR Code</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Quick Statistics Strip */}
      <section
        aria-label="Quick statistics"
        className="grid grid-cols-2 divide-y divide-slate-200 rounded-2xl border border-slate-200/90 bg-white dark:divide-slate-800 dark:border-slate-800/90 dark:bg-[#0E1525] sm:grid-cols-4 sm:divide-x sm:divide-y-0"
      >
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Stored Documents
          </div>
          <div className="mt-1.5 font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {pdfs.length}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Scans
          </div>
          <div className="mt-1.5 font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {scans.length}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Saved QR Codes
          </div>
          <div className="mt-1.5 font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {generatedQrs.length}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Starred Favorites
          </div>
          <div className="mt-1.5 font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {favoriteCount}
          </div>
        </div>
      </section>

      {/* Recent Documents & Recent Scans */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Recent Documents */}
        <div className="rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800/90 dark:bg-[#0E1525]">
          <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-4 dark:border-slate-800/80">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Recent Documents
            </h2>
            <Link
              to="/documents"
              className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400 whitespace-nowrap"
            >
              View all
            </Link>
          </div>

          {recentPdfs.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <FileText className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                No PDFs imported yet
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Import a document to read offline and track your reading progress.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Import First PDF</span>
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {recentPdfs.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between gap-3 px-6 py-3.5 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/reader/${doc.id}`)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {doc.name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>
                        Page {doc.lastPage} of {doc.pageCount}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{formatBytes(doc.size)}</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTogglePdfFavorite(doc.id, doc.favorite)}
                    aria-label={doc.favorite ? 'Unstar document' : 'Star document'}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Star
                      className={`h-4 w-4 ${
                        doc.favorite ? 'fill-amber-400 text-amber-400' : ''
                      }`}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Scans */}
        <div className="rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800/90 dark:bg-[#0E1525]">
          <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-4 dark:border-slate-800/80">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Recent Scans
            </h2>
            <Link
              to="/history"
              className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400 whitespace-nowrap"
            >
              View all
            </Link>
          </div>

          {recentScans.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <ScanLine className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                No scans recorded yet
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Scan a QR code or barcode with your camera or an image file.
              </p>
              <Link
                to="/scanner"
                className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-medium text-white hover:bg-purple-700"
              >
                <ScanLine className="h-3.5 w-3.5" />
                <span>Open Scanner</span>
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {recentScans.map((scan) => (
                <li
                  key={scan.id}
                  className="flex items-center justify-between gap-3 px-6 py-3.5 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedScan(scan)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {scan.parsed.displayTitle}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>{scan.kind === 'qr' ? 'QR Code' : scan.format}</span>
                      <span aria-hidden="true">·</span>
                      <span>{new Date(scan.timestamp).toLocaleDateString()}</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleScanFav(scan.id)}
                    aria-label={scan.favorite ? 'Unstar scan' : 'Star scan'}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Star
                      className={`h-4 w-4 ${
                        scan.favorite ? 'fill-amber-400 text-amber-400' : ''
                      }`}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Favorites Section */}
      {(favoritePdfs.length > 0 || favoriteScans.length > 0) && (
        <section className="rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800/90 dark:bg-[#0E1525]">
          <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-4 dark:border-slate-800/80">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Starred Favorites
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {favoritePdfs.length + favoriteScans.length} pinned
            </span>
          </div>
          <div className="grid divide-y divide-slate-100 dark:divide-slate-800/80 md:grid-cols-2 md:divide-x md:divide-y-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {favoritePdfs.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => navigate(`/reader/${doc.id}`)}
                  className="flex w-full items-center justify-between gap-3 px-6 py-3.5 text-left hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {doc.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      PDF · Page {doc.lastPage}/{doc.pageCount}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              ))}
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {favoriteScans.map((scan) => (
                <button
                  key={scan.id}
                  type="button"
                  onClick={() => setSelectedScan(scan)}
                  className="flex w-full items-center justify-between gap-3 px-6 py-3.5 text-left hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {scan.parsed.displayTitle}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {scan.kind === 'qr' ? 'QR Code' : scan.format} · {scan.parsed.type}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <ScanResultSheet
        item={selectedScan}
        onClose={() => setSelectedScan(null)}
        onToggleFavorite={handleToggleScanFav}
      />
    </div>
  );
};
