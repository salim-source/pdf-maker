import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PdfDocumentMeta } from '../types';
import { createId, savePdfDocument } from './storageService';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export { pdfjsLib };

function formatPdfDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  // PDF date format: D:YYYYMMDDHHmmSS...
  const match = raw.match(/D:(\d{4})(\d{2})?(\d{2})?/);
  if (!match) return raw;
  const [, year, month = '01', day = '01'] = match;
  return `${year}-${month}-${day}`;
}

export async function importPdfFile(file: File): Promise<PdfDocumentMeta> {
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    throw new Error(`"${file.name}" is not a valid PDF document.`);
  }

  const buffer = await file.arrayBuffer();
  const copyForStorage = buffer.slice(0);

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdfDoc = await loadingTask.promise;

  let title: string | undefined;
  let author: string | undefined;
  let subject: string | undefined;
  let creator: string | undefined;
  let creationDate: string | undefined;

  try {
    const metadata = await pdfDoc.getMetadata();
    const info = metadata?.info as Record<string, unknown> | undefined;
    if (info) {
      if (typeof info.Title === 'string' && info.Title.trim()) title = info.Title.trim();
      if (typeof info.Author === 'string' && info.Author.trim()) author = info.Author.trim();
      if (typeof info.Subject === 'string' && info.Subject.trim()) subject = info.Subject.trim();
      if (typeof info.Creator === 'string' && info.Creator.trim()) creator = info.Creator.trim();
      if (typeof info.CreationDate === 'string' && info.CreationDate.trim()) {
        creationDate = formatPdfDate(info.CreationDate.trim());
      }
    }
  } catch {
    // Metadata extraction is optional
  }

  const pageCount = pdfDoc.numPages;
  await loadingTask.destroy();

  const now = Date.now();
  const meta: PdfDocumentMeta = {
    id: createId('pdf'),
    name: file.name,
    size: file.size,
    pageCount,
    lastPage: 1,
    bookmarks: [],
    favorite: false,
    addedAt: now,
    lastOpenedAt: now,
    title,
    author,
    subject,
    creator,
    creationDate,
  };

  await savePdfDocument(meta, copyForStorage);
  return meta;
}
