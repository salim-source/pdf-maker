import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Mail,
  Phone,
  Share2,
  Star,
  User,
  Wifi,
  X,
} from 'lucide-react';
import type { ScanHistoryItem } from '../types';
import { useApp } from '../context/AppContext';
import { ConfirmDialog } from './ConfirmDialog';

interface ScanResultSheetProps {
  item: ScanHistoryItem | null;
  onClose: () => void;
  onToggleFavorite?: (id: string) => void;
}

export const ScanResultSheet: React.FC<ScanResultSheetProps> = ({
  item,
  onClose,
  onToggleFavorite,
}) => {
  const { preferences, showToast } = useApp();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [pendingExternalUrl, setPendingExternalUrl] = useState<string | null>(null);

  if (!item) return null;

  const { parsed } = item;

  const copyValue = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      showToast(`${label} copied to clipboard`, 'success');
      window.setTimeout(() => setCopiedField(null), 1800);
    } catch {
      showToast('Clipboard permission unavailable', 'error');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: parsed.displayTitle,
          text: item.rawValue,
        });
        return;
      } catch {
        // User cancelled or unsupported
      }
    }
    await copyValue(item.rawValue, 'Scan content');
  };

  const handleUrlClick = (url: string) => {
    if (preferences.confirmBeforeOpeningUrls) {
      setPendingExternalUrl(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const downloadVCard = () => {
    if (!parsed.contact) return;
    const blob = new Blob([parsed.contact.rawVCard], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${parsed.contact.name.replace(/[^\w\-]+/g, '_') || 'contact'}.vcf`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Contact card (.vcf) downloaded', 'success');
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      >
        <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#0E1525] sm:rounded-2xl">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{item.kind === 'qr' ? 'QR Code' : 'Barcode'}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{item.format}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {new Date(item.timestamp).toLocaleString()}
                </span>
              </div>
              <h3 className="mt-1.5 truncate text-lg font-semibold text-slate-900 dark:text-white">
                {parsed.displayTitle}
              </h3>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {onToggleFavorite && (
                <button
                  type="button"
                  onClick={() => onToggleFavorite(item.id)}
                  aria-label={item.favorite ? 'Remove from favorites' : 'Add to favorites'}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <Star
                    className={`h-4 w-4 ${
                      item.favorite ? 'fill-amber-400 text-amber-400' : ''
                    }`}
                  />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close scan result"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Structured payload details */}
          {parsed.type === 'wifi' && parsed.wifi && (
            <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#070B14]">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400">
                <Wifi className="h-4 w-4" />
                <span>Wi-Fi Network Credentials</span>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400">Network (SSID)</dt>
                  <dd className="font-mono font-medium text-slate-900 dark:text-white">
                    {parsed.wifi.ssid}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400">Security</dt>
                  <dd className="font-mono text-slate-900 dark:text-white">
                    {parsed.wifi.encryption}
                  </dd>
                </div>
                {parsed.wifi.password && (
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500 dark:text-slate-400">Password</dt>
                    <dd className="flex items-center gap-2">
                      <span className="font-mono text-slate-900 dark:text-white">
                        {parsed.wifi.password}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyValue(parsed.wifi!.password, 'Wi-Fi password')}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        {copiedField === 'Wi-Fi password' ? 'Copied' : 'Copy'}
                      </button>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {parsed.type === 'contact' && parsed.contact && (
            <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#070B14]">
              <div className="flex items-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400">
                <User className="h-4 w-4" />
                <span>Contact Details</span>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400">Name</dt>
                  <dd className="font-medium text-slate-900 dark:text-white">
                    {parsed.contact.name}
                  </dd>
                </div>
                {parsed.contact.organization && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500 dark:text-slate-400">Organization</dt>
                    <dd className="text-slate-900 dark:text-white">
                      {parsed.contact.organization}
                    </dd>
                  </div>
                )}
                {parsed.contact.phone && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500 dark:text-slate-400">Phone</dt>
                    <dd className="font-mono text-slate-900 dark:text-white">
                      {parsed.contact.phone}
                    </dd>
                  </div>
                )}
                {parsed.contact.email && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500 dark:text-slate-400">Email</dt>
                    <dd className="font-mono text-slate-900 dark:text-white">
                      {parsed.contact.email}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          <div className="mt-4">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Raw Payload
            </div>
            <pre className="mt-1.5 max-h-40 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3.5 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-slate-800 dark:border-slate-800 dark:bg-[#070B14] dark:text-slate-200">
              {item.rawValue}
            </pre>
          </div>

          <div className="mt-6 flex flex-wrap gap-2.5">
            {parsed.type === 'url' && parsed.url && (
              <button
                type="button"
                onClick={() => handleUrlClick(parsed.url!)}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Open Link</span>
              </button>
            )}

            {parsed.type === 'email' && parsed.email && (
              <a
                href={`mailto:${parsed.email.address}`}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap"
              >
                <Mail className="h-4 w-4" />
                <span>Compose Email</span>
              </a>
            )}

            {parsed.type === 'phone' && parsed.phone && (
              <a
                href={`tel:${parsed.phone}`}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap"
              >
                <Phone className="h-4 w-4" />
                <span>Call Number</span>
              </a>
            )}

            {parsed.type === 'contact' && parsed.contact && (
              <button
                type="button"
                onClick={downloadVCard}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap"
              >
                <Download className="h-4 w-4" />
                <span>Save Contact (.vcf)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => copyValue(item.rawValue, 'Result')}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              {copiedField === 'Result' ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span>{copiedField === 'Result' ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Share2 className="h-4 w-4" />
              <span>Share</span>
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingExternalUrl}
        title="Open External Website?"
        description="Verify that you trust this destination before leaving Scanify. External websites are outside local device processing."
        detail={pendingExternalUrl || undefined}
        confirmLabel="Open Website"
        icon="external"
        onCancel={() => setPendingExternalUrl(null)}
        onConfirm={() => {
          if (pendingExternalUrl) {
            window.open(pendingExternalUrl, '_blank', 'noopener,noreferrer');
          }
          setPendingExternalUrl(null);
        }}
      />
    </>
  );
};
