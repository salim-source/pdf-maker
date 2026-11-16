import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  Search,
  Share2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { importPdfFile, pdfjsLib } from '../services/pdfService';
import { formatBytes, getPdfFileBuffer, updatePdfMeta } from '../services/storageService';
import type { PdfDocumentMeta } from '../types';

interface PdfPageCanvasProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  containerWidth: number;
  onVisible: (page: number) => void;
  registerRef: (page: number, el: HTMLDivElement | null) => void;
}

const PdfPageCanvas: React.FC<PdfPageCanvasProps> = ({
  pdfDoc,
  pageNumber,
  scale,
  containerWidth,
  onVisible,
  registerRef,
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isVisible, setIsVisible] = useState(pageNumber <= 3);
  const [pageDims, setPageDims] = useState<{ width: number; height: number }>({
    width: Math.min(720, Math.max(280, containerWidth - 32)),
    height: 920,
  });
  const [renderedKey, setRenderedKey] = useState<string>('');

  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      wrapperRef.current = el;
      registerRef(pageNumber, el);
    },
    [pageNumber, registerRef]
  );

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true);
            if (entry.intersectionRatio >= 0.45) {
              onVisible(pageNumber);
            }
          }
        }
      },
      {
        rootMargin: '400px 0px',
        threshold: [0.05, 0.45, 0.75],
      }
    );

    visibilityObserver.observe(el);
    return () => visibilityObserver.disconnect();
  }, [pageNumber, onVisible]);

  useEffect(() => {
    if (!isVisible) return;
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const fitWidth = Math.max(260, containerWidth - 32);
        const computedScale = (fitWidth / baseViewport.width) * scale;
        const viewport = page.getViewport({ scale: computedScale });

        setPageDims({ width: viewport.width, height: viewport.height });

        const targetKey = `${pageNumber}_${Math.round(viewport.width)}_${Math.round(viewport.height)}`;
        if (renderedKey === targetKey) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, viewport.width, viewport.height);

        renderTask = page.render({ canvasContext: ctx, viewport, canvas });
        await renderTask.promise;
        if (!cancelled) {
          setRenderedKey(targetKey);
        }
      } catch {
        // Ignore cancelled render tasks during fast zoom/scroll
      }
    };

    void renderPage();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDoc, pageNumber, scale, containerWidth, isVisible, renderedKey]);

  return (
    <div
      ref={setRefs}
      data-page-number={pageNumber}
      style={{ minHeight: `${Math.round(pageDims.height)}px` }}
      className="relative mx-auto flex justify-center"
    >
      <canvas
        ref={canvasRef}
        className="rounded-lg border border-slate-200 bg-white shadow-md dark:border-slate-800"
      />
      <span className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-slate-900/75 px-2 py-0.5 font-mono text-[11px] text-white tabular-nums">
        {pageNumber}
      </span>
    </div>
  );
};

interface SearchHit {
  page: number;
  snippet: string;
}

export const PdfReaderPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { pdfs, preferences, refreshData, showToast } = useApp();

  const [activeDocMeta, setActiveDocMeta] = useState<PdfDocumentMeta | null>(null);
  const [pdfProxy, setPdfProxy] = useState<PDFDocumentProxy | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [zoom, setZoom] = useState(preferences.defaultZoom || 1.0);
  const [containerWidth, setContainerWidth] = useState(760);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartZoom = useRef<number>(1);
  const lastSavedPageRef = useRef<number>(1);

  const selectedDocId = id || pdfs[0]?.id || null;

  const registerPageRef = useCallback((page: number, el: HTMLDivElement | null) => {
    if (el) pageRefs.current.set(page, el);
    else pageRefs.current.delete(page);
  }, []);

  // Track viewport width responsively
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const updateWidth = () => {
      setContainerWidth(Math.min(el.clientWidth, 920));
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pdfProxy]);

  // Load selected PDF from IndexedDB
  useEffect(() => {
    let cancelled = false;
    let loadedProxy: PDFDocumentProxy | null = null;

    const loadSelected = async () => {
      if (!selectedDocId) {
        setActiveDocMeta(null);
        setPdfProxy(null);
        return;
      }

      const meta = pdfs.find((p) => p.id === selectedDocId) || null;
      if (!meta) {
        setLoadError('Document not found in local storage.');
        return;
      }

      setIsLoadingDoc(true);
      setLoadError(null);
      setSearchHits([]);
      setSearchQuery('');

      try {
        const buffer = await getPdfFileBuffer(selectedDocId);
        if (!buffer) {
          throw new Error('PDF file data could not be loaded from browser storage.');
        }
        const task = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
        loadedProxy = await task.promise;
        if (cancelled) {
          await task.destroy();
          return;
        }

        const resumePage = Math.min(Math.max(meta.lastPage || 1, 1), loadedProxy.numPages);
        lastSavedPageRef.current = resumePage;
        setActiveDocMeta(meta);
        setPdfProxy(loadedProxy);
        setCurrentPage(resumePage);
        setPageInput(String(resumePage));
        setZoom(1);

        await updatePdfMeta(meta.id, { lastOpenedAt: Date.now() });

        if (resumePage > 1) {
          window.setTimeout(() => {
            pageRefs.current.get(resumePage)?.scrollIntoView({ behavior: 'auto', block: 'start' });
          }, 150);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Unable to open PDF document.');
        }
      } finally {
        if (!cancelled) setIsLoadingDoc(false);
      }
    };

    void loadSelected();
    return () => {
      cancelled = true;
      if (loadedProxy) {
        void loadedProxy.cleanup();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDocId]);

  // Keep activeDocMeta synced with context updates (bookmarks, favorites)
  useEffect(() => {
    if (!selectedDocId) return;
    const found = pdfs.find((p) => p.id === selectedDocId);
    if (found) setActiveDocMeta(found);
  }, [pdfs, selectedDocId]);

  const jumpToPage = useCallback(
    (targetPage: number) => {
      if (!pdfProxy) return;
      const clamped = Math.min(Math.max(1, targetPage), pdfProxy.numPages);
      setCurrentPage(clamped);
      setPageInput(String(clamped));
      const el = pageRefs.current.get(clamped);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [pdfProxy]
  );

  // Persist reading position as user scrolls
  const handlePageVisible = useCallback(
    (visiblePage: number) => {
      setCurrentPage(visiblePage);
      setPageInput(String(visiblePage));
      if (activeDocMeta && visiblePage !== lastSavedPageRef.current) {
        lastSavedPageRef.current = visiblePage;
        void updatePdfMeta(activeDocMeta.id, {
          lastPage: visiblePage,
          lastOpenedAt: Date.now(),
        });
      }
    },
    [activeDocMeta]
  );

  // Pinch-to-zoom touch gestures
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist.current = Math.hypot(dx, dy);
      pinchStartZoom.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchStartDist.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchStartDist.current;
      const next = Math.min(2.8, Math.max(0.6, Number((pinchStartZoom.current * ratio).toFixed(2))));
      setZoom(next);
    }
  };

  const handleTouchEnd = () => {
    pinchStartDist.current = null;
  };

  // Search inside PDF
  const handleRunSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim().toLowerCase();
    if (!pdfProxy || !q) {
      setSearchHits([]);
      return;
    }

    setIsSearching(true);
    const hits: SearchHit[] = [];
    try {
      for (let p = 1; p <= pdfProxy.numPages; p++) {
        const page = await pdfProxy.getPage(p);
        const textContent = await page.getTextContent();
        const combined = textContent.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ');
        const idx = combined.toLowerCase().indexOf(q);
        if (idx !== -1) {
          const start = Math.max(0, idx - 32);
          const end = Math.min(combined.length, idx + q.length + 48);
          hits.push({
            page: p,
            snippet: `${start > 0 ? '…' : ''}${combined.slice(start, end)}${
              end < combined.length ? '…' : ''
            }`,
          });
        }
      }
      setSearchHits(hits);
      if (hits.length > 0) {
        jumpToPage(hits[0].page);
      } else {
        showToast('No matching text found in PDF', 'info');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const isCurrentBookmarked = useMemo(
    () => (activeDocMeta ? activeDocMeta.bookmarks.includes(currentPage) : false),
    [activeDocMeta, currentPage]
  );

  const handleToggleBookmark = async () => {
    if (!activeDocMeta) return;
    const exists = activeDocMeta.bookmarks.includes(currentPage);
    const nextBookmarks = exists
      ? activeDocMeta.bookmarks.filter((p) => p !== currentPage)
      : [...activeDocMeta.bookmarks, currentPage].sort((a, b) => a - b);

    const updated = await updatePdfMeta(activeDocMeta.id, { bookmarks: nextBookmarks });
    if (updated) setActiveDocMeta(updated);
    await refreshData();
    showToast(
      exists ? `Removed bookmark on page ${currentPage}` : `Bookmarked page ${currentPage}`,
      'success'
    );
  };

  const handleSharePdf = async () => {
    if (!activeDocMeta) return;
    try {
      const buffer = await getPdfFileBuffer(activeDocMeta.id);
      if (!buffer) return;
      const file = new File([buffer], activeDocMeta.name, { type: 'application/pdf' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: activeDocMeta.title || activeDocMeta.name,
          files: [file],
        });
        return;
      }
      const blob = new Blob([buffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = activeDocMeta.name;
      link.click();
      URL.revokeObjectURL(url);
      showToast('Downloaded PDF copy for sharing', 'success');
    } catch {
      showToast('Unable to share PDF', 'error');
    }
  };

  const handleImportFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    try {
      const meta = await importPdfFile(file);
      await refreshData();
      showToast(`Opened "${meta.name}"`, 'success');
      navigate(`/reader/${meta.id}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Invalid PDF file', 'error');
    }
  };

  const pageNumbers = useMemo(() => {
    if (!pdfProxy) return [];
    return Array.from({ length: pdfProxy.numPages }, (_, idx) => idx + 1);
  }, [pdfProxy]);

  return (
    <div
      className="space-y-4"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        void handleImportFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          void handleImportFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Reader Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 dark:border-slate-800/90 dark:bg-[#0E1525]">
        <div className="flex min-w-0 items-center gap-2.5">
          {pdfs.length > 0 ? (
            <select
              aria-label="Switch recent PDF document"
              value={selectedDocId || ''}
              onChange={(e) => navigate(`/reader/${e.target.value}`)}
              className="max-w-[200px] truncate rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B14] dark:text-slate-100 sm:max-w-[280px]"
            >
              {pdfs.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              No PDF loaded
            </span>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Import</span>
          </button>
        </div>

        {pdfProxy && activeDocMeta && (
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Page Navigation */}
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-1.5 py-1 dark:border-slate-700 dark:bg-[#070B14]">
              <button
                type="button"
                aria-label="Previous page"
                disabled={currentPage <= 1}
                onClick={() => jumpToPage(currentPage - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-white disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const parsed = parseInt(pageInput, 10);
                  if (!Number.isNaN(parsed)) jumpToPage(parsed);
                }}
                className="flex items-center gap-1 px-1 text-xs font-mono tabular-nums"
              >
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Current page number"
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  className="w-10 rounded bg-transparent text-center font-medium text-slate-900 focus:outline-none dark:text-white"
                />
                <span className="text-slate-400">/ {pdfProxy.numPages}</span>
              </form>
              <button
                type="button"
                aria-label="Next page"
                disabled={currentPage >= pdfProxy.numPages}
                onClick={() => jumpToPage(currentPage + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-white disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-1.5 py-1 dark:border-slate-700 dark:bg-[#070B14]">
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                title="Reset to Fit Width"
                className="min-w-[46px] text-center font-mono text-xs font-medium text-slate-700 tabular-nums dark:text-slate-200"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => setZoom((z) => Math.min(2.8, Number((z + 0.15).toFixed(2))))}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>

            {/* Utility Actions */}
            <button
              type="button"
              onClick={() => {
                setShowSearch((s) => !s);
                setShowBookmarks(false);
                setShowMetadata(false);
              }}
              aria-label="Search inside PDF"
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                showSearch
                  ? 'border-blue-600 bg-blue-600/10 text-blue-600 dark:text-blue-400'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Search className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleToggleBookmark}
              aria-label={isCurrentBookmarked ? 'Remove bookmark' : 'Bookmark current page'}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                isCurrentBookmarked
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-500'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {isCurrentBookmarked ? (
                <BookmarkCheck className="h-4 w-4" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowBookmarks((b) => !b);
                setShowSearch(false);
                setShowMetadata(false);
              }}
              className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                showBookmarks
                  ? 'border-blue-600 bg-blue-600/10 text-blue-600 dark:text-blue-400'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span>Bookmarks</span>
              <span className="font-mono tabular-nums">({activeDocMeta.bookmarks.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowMetadata((m) => !m);
                setShowSearch(false);
                setShowBookmarks(false);
              }}
              aria-label="PDF metadata"
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                showMetadata
                  ? 'border-blue-600 bg-blue-600/10 text-blue-600 dark:text-blue-400'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Info className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleSharePdf}
              aria-label="Share PDF"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Contextual Side / Expandable Drawers */}
      {showSearch && pdfProxy && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0E1525]">
          <form onSubmit={handleRunSearch} className="flex gap-2">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search text across all pages…"
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B14] dark:text-white"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="min-h-[40px] rounded-xl bg-blue-600 px-4 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSearching ? 'Searching…' : 'Find'}
            </button>
            <button
              type="button"
              onClick={() => setShowSearch(false)}
              aria-label="Close search"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </form>

          {searchHits.length > 0 && (
            <div className="mt-3 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {searchHits.map((hit) => (
                <button
                  key={hit.page}
                  type="button"
                  onClick={() => jumpToPage(hit.page)}
                  className="flex w-full items-start gap-3 px-3.5 py-2.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <span className="shrink-0 font-mono font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                    Page {hit.page}
                  </span>
                  <span className="line-clamp-2 text-slate-600 dark:text-slate-300">
                    {hit.snippet}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {showBookmarks && activeDocMeta && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0E1525]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Bookmarked Pages
            </h3>
            <button
              type="button"
              onClick={() => setShowBookmarks(false)}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Close
            </button>
          </div>
          {activeDocMeta.bookmarks.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              No bookmarks yet. Tap the bookmark icon in the toolbar while reading any page.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {activeDocMeta.bookmarks.map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => jumpToPage(page)}
                  className={`min-h-[36px] rounded-xl border px-3 py-1.5 font-mono text-xs font-medium tabular-nums transition-colors ${
                    currentPage === page
                      ? 'border-blue-600 bg-blue-600/10 text-blue-600 dark:text-blue-400'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  Page {page}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {showMetadata && activeDocMeta && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0E1525]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Document Metadata
            </h3>
            <button
              type="button"
              onClick={() => setShowMetadata(false)}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Close
            </button>
          </div>
          <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Filename</dt>
              <dd className="mt-0.5 font-medium text-slate-900 dark:text-white break-all">
                {activeDocMeta.name}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Title</dt>
              <dd className="mt-0.5 font-medium text-slate-900 dark:text-white">
                {activeDocMeta.title || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Author</dt>
              <dd className="mt-0.5 font-medium text-slate-900 dark:text-white">
                {activeDocMeta.author || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Pages & Size</dt>
              <dd className="mt-0.5 font-mono text-slate-900 dark:text-white tabular-nums">
                {activeDocMeta.pageCount} pages · {formatBytes(activeDocMeta.size)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Creator</dt>
              <dd className="mt-0.5 text-slate-900 dark:text-white">
                {activeDocMeta.creator || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Created Date</dt>
              <dd className="mt-0.5 font-mono text-slate-900 dark:text-white tabular-nums">
                {activeDocMeta.creationDate || '—'}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* Main Document Canvas Viewport */}
      <div
        ref={viewportRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`relative min-h-[65vh] rounded-2xl border p-4 transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-500/5'
            : 'border-slate-200/90 bg-slate-100/80 dark:border-slate-800/90 dark:bg-[#0B1120]'
        }`}
      >
        {isLoadingDoc ? (
          <div className="flex min-h-[55vh] flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Rendering PDF document locally…
            </p>
          </div>
        ) : loadError ? (
          <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
            <FileText className="h-10 w-10 text-red-400" />
            <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
              Unable to open document
            </h3>
            <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Upload className="h-4 w-4" />
              <span>Import Another PDF</span>
            </button>
          </div>
        ) : !pdfProxy ? (
          <div className="flex min-h-[55vh] flex-col items-center justify-center px-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
              <FileText className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
              Import a PDF to begin reading
            </h2>
            <p className="mt-1.5 max-w-md text-sm text-slate-500 dark:text-slate-400">
              Drop any PDF file here or choose one from your device. Documents stay private in local browser storage and support large files, text search, and bookmarks.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Upload className="h-4 w-4" />
              <span>Select PDF from Device</span>
            </button>
          </div>
        ) : (
          <div className="space-y-5 overflow-x-auto py-2">
            {pageNumbers.map((pageNumber) => (
              <PdfPageCanvas
                key={`${activeDocMeta?.id}_${pageNumber}`}
                pdfDoc={pdfProxy}
                pageNumber={pageNumber}
                scale={zoom}
                containerWidth={containerWidth}
                onVisible={handlePageVisible}
                registerRef={registerPageRef}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
