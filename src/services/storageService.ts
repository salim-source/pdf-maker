import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  GeneratedQrItem,
  PdfDocumentMeta,
  PdfFileBlob,
  ScanHistoryItem,
  UserPreferences,
} from '../types';

const PREFS_KEY = 'scanify_preferences_v1';
const DB_NAME = 'scanify-local-db';
const DB_VERSION = 1;

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  soundEnabled: true,
  vibrationEnabled: true,
  defaultZoom: 1.15,
  confirmBeforeOpeningUrls: true,
};

interface ScanifyDB extends DBSchema {
  pdf_meta: {
    key: string;
    value: PdfDocumentMeta;
    indexes: { 'by-last-opened': number; 'by-added': number };
  };
  pdf_files: {
    key: string;
    value: PdfFileBlob;
  };
  scan_history: {
    key: string;
    value: ScanHistoryItem;
    indexes: { 'by-timestamp': number };
  };
  generated_qr: {
    key: string;
    value: GeneratedQrItem;
    indexes: { 'by-created': number };
  };
}

let dbPromise: Promise<IDBPDatabase<ScanifyDB>> | null = null;

function getDb(): Promise<IDBPDatabase<ScanifyDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ScanifyDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('pdf_meta')) {
          const metaStore = db.createObjectStore('pdf_meta', { keyPath: 'id' });
          metaStore.createIndex('by-last-opened', 'lastOpenedAt');
          metaStore.createIndex('by-added', 'addedAt');
        }
        if (!db.objectStoreNames.contains('pdf_files')) {
          db.createObjectStore('pdf_files', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('scan_history')) {
          const scanStore = db.createObjectStore('scan_history', { keyPath: 'id' });
          scanStore.createIndex('by-timestamp', 'timestamp');
        }
        if (!db.objectStoreNames.contains('generated_qr')) {
          const qrStore = db.createObjectStore('generated_qr', { keyPath: 'id' });
          qrStore.createIndex('by-created', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
}

export function loadPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      theme: parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system' ? parsed.theme : 'system',
      soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
      vibrationEnabled: typeof parsed.vibrationEnabled === 'boolean' ? parsed.vibrationEnabled : true,
      defaultZoom:
        typeof parsed.defaultZoom === 'number' && parsed.defaultZoom >= 0.5 && parsed.defaultZoom <= 3
          ? parsed.defaultZoom
          : 1.15,
      confirmBeforeOpeningUrls:
        typeof parsed.confirmBeforeOpeningUrls === 'boolean' ? parsed.confirmBeforeOpeningUrls : true,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
}

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// PDF Documents
export async function listPdfDocuments(): Promise<PdfDocumentMeta[]> {
  const db = await getDb();
  const docs = await db.getAll('pdf_meta');
  return docs.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

export async function getPdfMeta(id: string): Promise<PdfDocumentMeta | undefined> {
  const db = await getDb();
  return db.get('pdf_meta', id);
}

export async function getPdfFileBuffer(id: string): Promise<ArrayBuffer | undefined> {
  const db = await getDb();
  const record = await db.get('pdf_files', id);
  return record?.data;
}

export async function savePdfDocument(meta: PdfDocumentMeta, buffer: ArrayBuffer): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['pdf_meta', 'pdf_files'], 'readwrite');
  await tx.objectStore('pdf_meta').put(meta);
  await tx.objectStore('pdf_files').put({ id: meta.id, data: buffer });
  await tx.done;
}

export async function updatePdfMeta(id: string, patch: Partial<PdfDocumentMeta>): Promise<PdfDocumentMeta | undefined> {
  const db = await getDb();
  const existing = await db.get('pdf_meta', id);
  if (!existing) return undefined;
  const updated: PdfDocumentMeta = { ...existing, ...patch };
  await db.put('pdf_meta', updated);
  return updated;
}

export async function deletePdfDocument(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['pdf_meta', 'pdf_files'], 'readwrite');
  await tx.objectStore('pdf_meta').delete(id);
  await tx.objectStore('pdf_files').delete(id);
  await tx.done;
}

export async function clearAllPdfs(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['pdf_meta', 'pdf_files'], 'readwrite');
  await tx.objectStore('pdf_meta').clear();
  await tx.objectStore('pdf_files').clear();
  await tx.done;
}

// Scan History
export async function listScanHistory(): Promise<ScanHistoryItem[]> {
  const db = await getDb();
  const items = await db.getAll('scan_history');
  return items.sort((a, b) => b.timestamp - a.timestamp);
}

export async function addScanHistoryItem(item: ScanHistoryItem): Promise<void> {
  const db = await getDb();
  await db.put('scan_history', item);
}

export async function toggleScanFavorite(id: string): Promise<ScanHistoryItem | undefined> {
  const db = await getDb();
  const existing = await db.get('scan_history', id);
  if (!existing) return undefined;
  const updated = { ...existing, favorite: !existing.favorite };
  await db.put('scan_history', updated);
  return updated;
}

export async function deleteScanHistoryItem(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('scan_history', id);
}

export async function clearScanHistory(): Promise<void> {
  const db = await getDb();
  await db.clear('scan_history');
}

// Generated QR Codes
export async function listGeneratedQrs(): Promise<GeneratedQrItem[]> {
  const db = await getDb();
  const items = await db.getAll('generated_qr');
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveGeneratedQr(item: GeneratedQrItem): Promise<void> {
  const db = await getDb();
  await db.put('generated_qr', item);
}

export async function deleteGeneratedQr(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('generated_qr', id);
}

export async function clearGeneratedQrs(): Promise<void> {
  const db = await getDb();
  await db.clear('generated_qr');
}

export async function getStorageOverview(): Promise<{
  pdfCount: number;
  scanCount: number;
  qrCount: number;
  pdfTotalBytes: number;
  estimatedUsageBytes: number | null;
}> {
  const db = await getDb();
  const [pdfs, scans, qrs] = await Promise.all([
    db.getAll('pdf_meta'),
    db.getAll('scan_history'),
    db.getAll('generated_qr'),
  ]);
  const pdfTotalBytes = pdfs.reduce((acc, doc) => acc + doc.size, 0);
  let estimatedUsageBytes: number | null = null;
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      if (typeof est.usage === 'number') estimatedUsageBytes = est.usage;
    } catch {
      // ignore
    }
  }
  return {
    pdfCount: pdfs.length,
    scanCount: scans.length,
    qrCount: qrs.length,
    pdfTotalBytes,
    estimatedUsageBytes,
  };
}

export async function clearAllLocalCache(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['pdf_meta', 'pdf_files', 'scan_history', 'generated_qr'], 'readwrite');
  await tx.objectStore('pdf_meta').clear();
  await tx.objectStore('pdf_files').clear();
  await tx.objectStore('scan_history').clear();
  await tx.objectStore('generated_qr').clear();
  await tx.done;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val >= 10 || i === 0 ? val.toFixed(0) : val.toFixed(1)} ${units[i]}`;
}
