import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  BookmarkPlus,
  Check,
  Copy,
  Download,
  Globe,
  Mail,
  Phone,
  Share2,
  Trash2,
  Type,
  User,
  Wifi,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { GeneratedQrItem, QrGeneratorCategory } from '../types';
import { buildQrPayload, type GeneratorFormValues } from '../services/qrParserService';
import { createId, deleteGeneratedQr, saveGeneratedQr } from '../services/storageService';

const CATEGORIES: { id: QrGeneratorCategory; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'url', label: 'URL', icon: Globe },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'wifi', label: 'Wi-Fi', icon: Wifi },
  { id: 'contact', label: 'Contact', icon: User },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'phone', label: 'Phone', icon: Phone },
];

const COLOR_PRESETS = [
  { name: 'Classic Ink', fg: '#0F172A', bg: '#FFFFFF' },
  { name: 'Electric Blue', fg: '#1D4ED8', bg: '#FFFFFF' },
  { name: 'Royal Purple', fg: '#6D28D9', bg: '#FFFFFF' },
  { name: 'Midnight Dark', fg: '#E2E8F0', bg: '#070B14' },
];

const INITIAL_FORM: GeneratorFormValues = {
  url: 'https://scanify.app',
  text: '',
  emailTo: '',
  emailSubject: '',
  emailBody: '',
  phone: '',
  wifiSsid: '',
  wifiPassword: '',
  wifiEncryption: 'WPA',
  wifiHidden: false,
  contactName: '',
  contactOrg: '',
  contactPhone: '',
  contactEmail: '',
  contactUrl: '',
};

export const QrGeneratorPage: React.FC = () => {
  const { generatedQrs, refreshData, showToast } = useApp();
  const [category, setCategory] = useState<QrGeneratorCategory>('url');
  const [form, setForm] = useState<GeneratorFormValues>(INITIAL_FORM);
  const [fgColor, setFgColor] = useState('#0F172A');
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [errorLevel, setErrorLevel] = useState<'L' | 'M' | 'Q' | 'H'>('M');
  const [copiedPayload, setCopiedPayload] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const built = buildQrPayload(category, form);
  const isValid = !built.error && built.payload.length > 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isValid) return;

    QRCode.toCanvas(
      canvas,
      built.payload,
      {
        width: 320,
        margin: 2,
        errorCorrectionLevel: errorLevel,
        color: {
          dark: fgColor,
          light: bgColor,
        },
      },
      () => {
        // Rendered cleanly
      }
    );
  }, [built.payload, isValid, fgColor, bgColor, errorLevel]);

  const updateField = <K extends keyof GeneratorFormValues>(key: K, value: GeneratorFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleDownloadPng = async () => {
    if (!isValid) return;
    try {
      const dataUrl = await QRCode.toDataURL(built.payload, {
        width: 1024,
        margin: 2,
        errorCorrectionLevel: errorLevel,
        color: { dark: fgColor, light: bgColor },
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `scanify-qr-${category}.png`;
      link.click();
      showToast('Downloaded PNG QR code', 'success');
    } catch {
      showToast('Unable to export PNG', 'error');
    }
  };

  const handleDownloadSvg = async () => {
    if (!isValid) return;
    try {
      const svgString = await QRCode.toString(built.payload, {
        type: 'svg',
        margin: 2,
        errorCorrectionLevel: errorLevel,
        color: { dark: fgColor, light: bgColor },
      });
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `scanify-qr-${category}.svg`;
      link.click();
      URL.revokeObjectURL(url);
      showToast('Downloaded SVG QR code', 'success');
    } catch {
      showToast('Unable to export SVG', 'error');
    }
  };

  const handleShare = async () => {
    if (!isValid) return;
    try {
      const dataUrl = await QRCode.toDataURL(built.payload, {
        width: 1024,
        margin: 2,
        errorCorrectionLevel: errorLevel,
        color: { dark: fgColor, light: bgColor },
      });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `scanify-qr-${category}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: built.label,
          text: built.payload,
          files: [file],
        });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: built.label, text: built.payload });
        return;
      }
    } catch {
      // Fallback to clipboard
    }
    await handleCopyPayload();
  };

  const handleCopyPayload = async () => {
    if (!isValid) return;
    try {
      await navigator.clipboard.writeText(built.payload);
      setCopiedPayload(true);
      showToast('QR payload copied to clipboard', 'success');
      window.setTimeout(() => setCopiedPayload(false), 1800);
    } catch {
      showToast('Clipboard access unavailable', 'error');
    }
  };

  const handleSaveToLibrary = async () => {
    if (!isValid) return;
    const item: GeneratedQrItem = {
      id: createId('qr'),
      category,
      label: built.label,
      payload: built.payload,
      foregroundColor: fgColor,
      backgroundColor: bgColor,
      createdAt: Date.now(),
      favorite: false,
    };
    await saveGeneratedQr(item);
    await refreshData();
    showToast('Saved QR code to local library', 'success');
  };

  const handleDeleteSaved = async (id: string) => {
    await deleteGeneratedQr(id);
    await refreshData();
    showToast('Removed saved QR code', 'info');
  };

  const loadSavedItem = (item: GeneratedQrItem) => {
    setCategory(item.category);
    setFgColor(item.foregroundColor);
    setBgColor(item.backgroundColor);
    if (item.category === 'url') updateField('url', item.payload);
    else if (item.category === 'text') updateField('text', item.payload);
    else if (item.category === 'phone') updateField('phone', item.payload.replace(/^tel:/i, ''));
    showToast(`Loaded "${item.label}"`, 'info');
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Form Builder */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800/90 dark:bg-[#0E1525] lg:col-span-7">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Select QR Content Type
          </h2>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const active = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'border-blue-600 bg-blue-600/10 text-blue-600 dark:border-blue-500 dark:bg-blue-500/15 dark:text-blue-400'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 space-y-4">
            {category === 'url' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Website URL
                </label>
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) => updateField('url', e.target.value)}
                  placeholder="https://example.com"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B14] dark:text-white"
                />
              </div>
            )}

            {category === 'text' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Plain Text Content
                </label>
                <textarea
                  rows={4}
                  value={form.text}
                  onChange={(e) => updateField('text', e.target.value)}
                  placeholder="Enter note, serial number, or message…"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B14] dark:text-white"
                />
              </div>
            )}

            {category === 'email' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Recipient Email
                  </label>
                  <input
                    type="email"
                    value={form.emailTo}
                    onChange={(e) => updateField('emailTo', e.target.value)}
                    placeholder="hello@company.com"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B14] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Subject (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.emailSubject}
                    onChange={(e) => updateField('emailSubject', e.target.value)}
                    placeholder="Inquiry"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B14] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Message Body (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={form.emailBody}
                    onChange={(e) => updateField('emailBody', e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B14] dark:text-white"
                  />
                </div>
              </div>
            )}

            {category === 'phone' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="+1 555 019 2834"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B14] dark:text-white"
                />
              </div>
            )}

            {category === 'wifi' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Network Name (SSID)
                  </label>
                  <input
                    type="text"
                    value={form.wifiSsid}
                    onChange={(e) => updateField('wifiSsid', e.target.value)}
                    placeholder="Studio-5G"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B14] dark:text-white"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                      Security
                    </label>
                    <select
                      value={form.wifiEncryption}
                      onChange={(e) =>
                        updateField('wifiEncryption', e.target.value as 'WPA' | 'WEP' | 'nopass')
                      }
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B14] dark:text-white"
                    >
                      <option value="WPA">WPA / WPA2 / WPA3</option>
                      <option value="WEP">WEP</option>
                      <option value="nopass">Open Network (No Password)</option>
                    </select>
                  </div>
                  {form.wifiEncryption !== 'nopass' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                        Password
                      </label>
                      <input
                        type="text"
                        value={form.wifiPassword}
                        onChange={(e) => updateField('wifiPassword', e.target.value)}
                        placeholder="Network password"
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B14] dark:text-white"
                      />
                    </div>
                  )}
                </div>
                <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.wifiHidden}
                    onChange={(e) => updateField('wifiHidden', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  <span>Hidden SSID network</span>
                </label>
              </div>
            )}

            {category === 'contact' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={form.contactName}
                    onChange={(e) => updateField('contactName', e.target.value)}
                    placeholder="Alex Morgan"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B14] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Organization
                  </label>
                  <input
                    type="text"
                    value={form.contactOrg}
                    onChange={(e) => updateField('contactOrg', e.target.value)}
                    placeholder="Scanify Labs"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B14] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={form.contactPhone}
                    onChange={(e) => updateField('contactPhone', e.target.value)}
                    placeholder="+1 555 014 7800"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B14] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => updateField('contactEmail', e.target.value)}
                    placeholder="alex@example.com"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B14] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Website
                  </label>
                  <input
                    type="url"
                    value={form.contactUrl}
                    onChange={(e) => updateField('contactUrl', e.target.value)}
                    placeholder="https://example.com"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B14] dark:text-white"
                  />
                </div>
              </div>
            )}

            {built.error && (
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                {built.error}
              </p>
            )}
          </div>

          {/* Appearance Customization */}
          <div className="mt-6 border-t border-slate-200/80 pt-5 dark:border-slate-800/80">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Style Presets
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setFgColor(preset.fg);
                        setBgColor(preset.bg);
                      }}
                      className={`inline-flex min-h-[36px] items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        fgColor === preset.fg && bgColor === preset.bg
                          ? 'border-blue-600 bg-blue-600/10 text-blue-600 dark:text-blue-400'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span
                        className="h-3.5 w-3.5 rounded-sm border border-slate-300"
                        style={{ backgroundColor: preset.fg }}
                      />
                      <span>{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Error Correction
                </div>
                <div className="mt-2 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-[#070B14]">
                  {(['L', 'M', 'Q', 'H'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setErrorLevel(lvl)}
                      className={`min-w-[36px] rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                        errorLevel === lvl
                          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Live Preview & Actions */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800/90 dark:bg-[#0E1525] lg:col-span-5">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Live Preview
              </h2>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {isValid ? `${built.payload.length} chars` : 'Awaiting input'}
              </span>
            </div>

            <div className="mt-5 flex min-h-[280px] items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50 p-6 dark:border-slate-800 dark:bg-[#070B14]">
              {isValid ? (
                <canvas
                  ref={canvasRef}
                  className="max-w-full rounded-xl shadow-sm"
                  aria-label={`Generated QR code for ${built.label}`}
                />
              ) : (
                <div className="text-center text-sm text-slate-500 dark:text-slate-400">
                  Enter valid fields on the left to generate your QR code.
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={!isValid}
                onClick={handleDownloadPng}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-45 whitespace-nowrap"
              >
                <Download className="h-4 w-4" />
                <span>Download PNG</span>
              </button>
              <button
                type="button"
                disabled={!isValid}
                onClick={handleDownloadSvg}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-45 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <Download className="h-4 w-4" />
                <span>Export SVG</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={!isValid}
                onClick={handleSaveToLibrary}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-45 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                <span>Save</span>
              </button>
              <button
                type="button"
                disabled={!isValid}
                onClick={handleCopyPayload}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-45 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                {copiedPayload ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>{copiedPayload ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                type="button"
                disabled={!isValid}
                onClick={handleShare}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-45 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Share</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Saved Generated QR Codes */}
      <section className="rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800/90 dark:bg-[#0E1525]">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-4 dark:border-slate-800/80">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Saved QR Codes
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {generatedQrs.length} saved
          </span>
        </div>

        {generatedQrs.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Save generated QR codes to keep quick offline access for sharing and printing.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {generatedQrs.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 px-6 py-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
              >
                <button
                  type="button"
                  onClick={() => loadSavedItem(item)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate text-sm font-medium text-slate-900 dark:text-white">
                    {item.label}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    <span className="uppercase">{item.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSaved(item.id)}
                  aria-label={`Delete ${item.label}`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
