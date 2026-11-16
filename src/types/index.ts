export type ThemeMode = 'light' | 'dark' | 'system';

export interface UserPreferences {
  theme: ThemeMode;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  defaultZoom: number;
  confirmBeforeOpeningUrls: boolean;
}

export interface PdfDocumentMeta {
  id: string;
  name: string;
  size: number;
  pageCount: number;
  lastPage: number;
  bookmarks: number[];
  favorite: boolean;
  addedAt: number;
  lastOpenedAt: number;
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  creationDate?: string;
}

export interface PdfFileBlob {
  id: string;
  data: ArrayBuffer;
}

export type ScanContentType = 'url' | 'wifi' | 'contact' | 'email' | 'phone' | 'text';

export interface WifiScanData {
  ssid: string;
  encryption: 'WPA' | 'WEP' | 'nopass' | string;
  password: string;
  hidden: boolean;
}

export interface ContactScanData {
  name: string;
  organization?: string;
  phone?: string;
  email?: string;
  url?: string;
  address?: string;
  rawVCard: string;
}

export interface EmailScanData {
  address: string;
  subject?: string;
  body?: string;
}

export interface ParsedScanData {
  type: ScanContentType;
  displayTitle: string;
  subtitle: string;
  url?: string;
  wifi?: WifiScanData;
  contact?: ContactScanData;
  email?: EmailScanData;
  phone?: string;
  text: string;
}

export interface ScanHistoryItem {
  id: string;
  rawValue: string;
  format: string;
  kind: 'qr' | 'barcode';
  contentType: ScanContentType;
  parsed: ParsedScanData;
  timestamp: number;
  favorite: boolean;
  source: 'camera' | 'image';
}

export type QrGeneratorCategory = 'url' | 'text' | 'email' | 'phone' | 'wifi' | 'contact';

export interface GeneratedQrItem {
  id: string;
  category: QrGeneratorCategory;
  label: string;
  payload: string;
  foregroundColor: string;
  backgroundColor: string;
  createdAt: number;
  favorite: boolean;
}
