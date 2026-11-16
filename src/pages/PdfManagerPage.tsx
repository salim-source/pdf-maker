import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownUp,
  BookOpen,
  Edit3,
  FileText,
  Search,
  Share2,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { importPdfFile } from '../services/pdfService';
import {
  deletePdfDocument,
  formatBytes,
  getPdfFileBuffer,
  updatePdfMeta,
} from '../services/storageService';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { PdfDocumentMeta } from '../types';

type DocFilter = 'all' | 'recent' | 'favorites';
type SortField = 'date' | 'name' | 'size';

export const PdfManagerPage: React.FC = () => {
  const { pdfs, refreshData, showToast } = useApp();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DocFilter>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortAsc, setSortAsc] = useState(false);

  const [renamingDoc, setRenamingDoc] = useState<PdfDocumentMeta | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingDoc, setDeletingDoc] = useState<PdfDocumentMeta | null>(null);

  const filteredAndSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = pdfs.filter((doc) => {
      if (filter === 'favorites' && !doc.favorite) return false;
      if (!q) return true;
      return (
        doc.name.toLowerCase().includes(q) ||
        (doc.title || '').toLowerCase().includes(q) ||
        (doc.author || '').toLowerCase().includes(q)
      );
    });

    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') cmp = a.lastOpenedAt - b.lastOpenedAt;
      else if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'size') cmp = a.size - b.size;
      return sortAsc ? cmp : -cmp;
    });

    return filter === 'recent' ? sorted.slice(0, 10) : sorted;
  }, [pdfs, query, filter, sortField, sortAsc]);

  const handleImportFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    let count = 0;
    for (const file of Array.from(files)) {
      try {
        await importPdfFile(file);
        count++;
      } catch (err) {
        showToast(err instanceof Error ? err.message : `Failed to import ${file.name}`, 'error');
      }
    }
    if (count > 0) {
      await refreshData();
      showToast(`Imported ${count} PDF ${count === 1 ? 'document' : 'documents'}`, 'success');
    }
  };

  const handleToggleFavorite = async (doc: PdfDocumentMeta) => {
    await updatePdfMeta(doc.id, { favorite: !doc.favorite });
    await refreshData();
  };

  const handleConfirmRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingDoc) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      showToast('Document name cannot be empty', 'error');
      return;
    }
    const finalName = trimmed.toLowerCase().endsWith('.pdf') ? trimmed : `${trimmed}.pdf`;
    await updatePdfMeta(renamingDoc.id, { name: finalName });
    await refreshData();
    setRenamingDoc(null);
    showToast('Document renamed', 'success');
  };

  const handleConfirmDelete = async () => {
    if (!deletingDoc) return;
    await deletePdfDocument(deletingDoc.id);
    await refreshData();
    setDeletingDoc(null);
    showToast('PDF document removed', 'info');
  };

  const handleShareDoc = async (doc: PdfDocumentMeta) => {
    try {
      const buffer = await getPdfFileBuffer(doc.id);
      if (!buffer) return;
      const file = new File([buffer], doc.name, { type: 'application/pdf' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: doc.name, files: [file] });
        return;
      }
      const blob = new Blob([buffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.name;
      link.click();
      URL.revokeObjectURL(url);
      showToast('Downloaded PDF copy', 'success');
    } catch {
      showToast('Unable to share PDF', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          void handleImportFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Search, Filter & Sort Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-slate-800/90 dark:bg-[#0E1525] lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search PDFs by filename, title, or author…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B14] dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-[#070B14]">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'recent', label: 'Recent' },
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

          <div className="flex items-center gap-1.5">
            <select
              aria-label="Sort documents by"
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B14] dark:text-slate-200"
            >
              <option value="date">Sort: Date</option>
              <option value="name">Sort: Name</option>
              <option value="size">Sort: Size</option>
            </select>

            <button
              type="button"
              onClick={() => setSortAsc((a) => !a)}
              aria-label="Toggle sort order"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ArrowDownUp className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Add PDFs</span>
          </button>
        </div>
      </div>

      {/* Document List */}
      <div className="rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800/90 dark:bg-[#0E1525]">
        {filteredAndSorted.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <FileText className="mx-auto h-9 w-9 text-slate-400" />
            <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
              {pdfs.length === 0 ? 'Your PDF library is empty' : 'No documents match your filter'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {pdfs.length === 0
                ? 'Import one or more PDF files from your device to browse, bookmark, and read offline.'
                : 'Adjust your search query or switch filter tabs.'}
            </p>
            {pdfs.length === 0 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Upload className="h-4 w-4" />
                <span>Import PDFs</span>
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredAndSorted.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/30 sm:flex-row sm:items-center sm:justify-between"
              >
                <button
                  type="button"
                  onClick={() => navigate(`/reader/${doc.id}`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <BookOpen className="h-4 w-4 shrink-0 text-blue-500" />
                    <span className="truncate text-sm font-medium text-slate-900 dark:text-white">
                      {doc.name}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 pl-6.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>
                      Page {doc.lastPage} of {doc.pageCount}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{formatBytes(doc.size)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{new Date(doc.lastOpenedAt).toLocaleDateString()}</span>
                  </div>
                </button>

                <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleFavorite(doc)}
                    aria-label={doc.favorite ? 'Remove favorite' : 'Mark favorite'}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Star
                      className={`h-4 w-4 ${
                        doc.favorite ? 'fill-amber-400 text-amber-400' : ''
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingDoc(doc);
                      setRenameValue(doc.name);
                    }}
                    aria-label="Rename document"
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShareDoc(doc)}
                    aria-label="Share PDF document"
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingDoc(doc)}
                    aria-label="Delete PDF document"
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

      {/* Rename Modal */}
      {renamingDoc && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <form
            onSubmit={handleConfirmRename}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#0E1525]"
          >
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Rename Document
            </h2>
            <input
              type="text"
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B14] dark:text-white"
            />
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRenamingDoc(null)}
                className="min-h-[44px] rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Save Name
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={!!deletingDoc}
        title="Delete PDF Document?"
        description="This removes the document, its bookmarks, and reading position from local browser storage."
        detail={deletingDoc?.name}
        confirmLabel="Delete PDF"
        tone="danger"
        onCancel={() => setDeletingDoc(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
