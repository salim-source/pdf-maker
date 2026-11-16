import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import {
  Camera,
  CameraOff,
  Flashlight,
  FlashlightOff,
  ImagePlus,
  RefreshCw,
  SwitchCamera,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isQrFormat, parseScanPayload } from '../services/qrParserService';
import { addScanHistoryItem, createId, toggleScanFavorite } from '../services/storageService';
import { playScanBeep, triggerHaptic } from '../services/feedbackService';
import { ScanResultSheet } from '../components/ScanResultSheet';
import type { ScanHistoryItem } from '../types';

const SUPPORTED_FORMATS = [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.AZTEC,
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.PDF_417,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.ITF,
  BarcodeFormat.CODABAR,
];

export const QrScannerPage: React.FC = () => {
  const { preferences, refreshData, showToast } = useApp();

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const lastDecodedRef = useRef<{ value: string; time: number }>({ value: '', time: 0 });

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraState, setCameraState] = useState<'initializing' | 'active' | 'denied' | 'unavailable'>(
    'initializing'
  );
  const [cameraError, setCameraError] = useState<string>('');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [activeResult, setActiveResult] = useState<ScanHistoryItem | null>(null);
  const [isScanningPaused, setIsScanningPaused] = useState(false);

  const createReader = useCallback(() => {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, SUPPORTED_FORMATS);
    hints.set(DecodeHintType.TRY_HARDER, true);
    return new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 180,
    });
  }, []);

  const recordDecodedResult = useCallback(
    async (rawText: string, formatName: string, source: 'camera' | 'image') => {
      const now = Date.now();
      if (
        source === 'camera' &&
        lastDecodedRef.current.value === rawText &&
        now - lastDecodedRef.current.time < 3000
      ) {
        return;
      }
      lastDecodedRef.current = { value: rawText, time: now };

      playScanBeep(preferences.soundEnabled);
      triggerHaptic(preferences.vibrationEnabled);

      const parsed = parseScanPayload(rawText);
      const item: ScanHistoryItem = {
        id: createId('scan'),
        rawValue: rawText,
        format: formatName,
        kind: isQrFormat(formatName) ? 'qr' : 'barcode',
        contentType: parsed.type,
        parsed,
        timestamp: now,
        favorite: false,
        source,
      };

      await addScanHistoryItem(item);
      await refreshData();
      setIsScanningPaused(true);
      setActiveResult(item);
    },
    [preferences.soundEnabled, preferences.vibrationEnabled, refreshData]
  );

  const stopCamera = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {
      // ignore
    }
    controlsRef.current = null;
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setTorchEnabled(false);
    setTorchSupported(false);
  }, []);

  const startCamera = useCallback(
    async (deviceId?: string) => {
      stopCamera();
      setCameraState('initializing');
      setCameraError('');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraState('unavailable');
        setCameraError('Camera API is unavailable in this browser context.');
        return;
      }

      try {
        const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
        setDevices(videoInputDevices);

        let targetId = deviceId;
        if (!targetId && videoInputDevices.length > 0) {
          const backCamera = videoInputDevices.find((d) =>
            /back|rear|environment/i.test(d.label)
          );
          targetId = (backCamera || videoInputDevices[0]).deviceId;
          setSelectedDeviceId(targetId);
        }

        if (!videoRef.current) return;
        const reader = createReader();

        const controls = await reader.decodeFromVideoDevice(
          targetId,
          videoRef.current,
          (result) => {
            if (result && !isScanningPaused) {
              const fmt = BarcodeFormat[result.getBarcodeFormat()] || 'QR_CODE';
              void recordDecodedResult(result.getText(), fmt, 'camera');
            }
          }
        );

        controlsRef.current = controls;
        setCameraState('active');

        // Inspect torch hardware capability
        const stream = videoRef.current.srcObject as MediaStream | null;
        const track = stream?.getVideoTracks()[0];
        if (track && typeof track.getCapabilities === 'function') {
          const caps = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
          setTorchSupported(Boolean(caps.torch));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to access camera.';
        if (/permission|denied|notallowed/i.test(message)) {
          setCameraState('denied');
          setCameraError(
            'Camera permission was denied. Grant camera access in your browser settings or scan an image file below.'
          );
        } else {
          setCameraState('unavailable');
          setCameraError(
            'No active camera stream detected. You can still upload an image containing a QR code or barcode.'
          );
        }
      }
    },
    [createReader, isScanningPaused, recordDecodedResult, stopCamera]
  );

  useEffect(() => {
    void startCamera(selectedDeviceId || undefined);
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSwitchCamera = () => {
    if (devices.length < 2) return;
    const idx = devices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextDevice = devices[(idx + 1) % devices.length];
    setSelectedDeviceId(nextDevice.deviceId);
    void startCamera(nextDevice.deviceId);
  };

  const handleToggleTorch = async () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks()[0];
    if (!track || !torchSupported) return;
    const next = !torchEnabled;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorchEnabled(next);
    } catch {
      showToast('Flashlight toggle unsupported on this device', 'error');
    }
  };

  const handleScanImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    try {
      const reader = createReader();
      const result = await reader.decodeFromImageUrl(objectUrl);
      const fmt = BarcodeFormat[result.getBarcodeFormat()] || 'QR_CODE';
      await recordDecodedResult(result.getText(), fmt, 'image');
    } catch {
      showToast('No QR code or barcode detected in that image', 'error');
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleToggleFavorite = async (id: string) => {
    const updated = await toggleScanFavorite(id);
    await refreshData();
    if (updated && activeResult?.id === id) {
      setActiveResult(updated);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleScanImageFile}
      />

      {/* Live Camera Viewfinder */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[#050914] shadow-lg dark:border-slate-800">
        <div className="relative aspect-[4/3] w-full sm:aspect-[16/10]">
          <video
            ref={videoRef}
            muted
            playsInline
            className="h-full w-full object-cover"
          />

          {/* Animated Scan Frame Overlay */}
          {cameraState === 'active' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
              <div className="relative h-56 w-56 sm:h-64 sm:w-64">
                <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-4 border-t-4 border-blue-500" />
                <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-4 border-t-4 border-blue-500" />
                <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 border-purple-500" />
                <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-4 border-r-4 border-purple-500" />
                <div className="animate-scan-beam absolute inset-x-3 h-0.5 rounded-full bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.85)]" />
              </div>
            </div>
          )}

          {/* Initializing / Error States */}
          {cameraState !== 'active' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070B14]/95 p-6 text-center text-white">
              {cameraState === 'initializing' ? (
                <>
                  <Camera className="h-9 w-9 text-blue-400" />
                  <p className="mt-3 text-sm font-medium">Starting camera preview…</p>
                </>
              ) : (
                <>
                  <CameraOff className="h-10 w-10 text-slate-400" />
                  <h2 className="mt-3 text-base font-semibold">
                    {cameraState === 'denied' ? 'Camera Permission Required' : 'Camera Unavailable'}
                  </h2>
                  <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-300">
                    {cameraError}
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => startCamera(selectedDeviceId || undefined)}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>Retry Camera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      <ImagePlus className="h-4 w-4" />
                      <span>Scan Image File</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Camera Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-[#0B1120] px-5 py-3.5 text-white">
          <div className="text-xs text-slate-300">
            Supports QR, Wi-Fi, vCard, URLs, EAN-13, UPC, Code 128, and Data Matrix
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/70 px-3.5 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800 whitespace-nowrap"
            >
              <ImagePlus className="h-4 w-4" />
              <span>Scan Image</span>
            </button>

            <button
              type="button"
              disabled={!torchSupported}
              onClick={handleToggleTorch}
              title={torchSupported ? 'Toggle Flashlight' : 'Flashlight unavailable on this camera'}
              className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                torchEnabled
                  ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                  : 'border-slate-700 bg-slate-800/70 text-slate-100 hover:bg-slate-800 disabled:opacity-40'
              }`}
            >
              {torchEnabled ? (
                <Flashlight className="h-4 w-4" />
              ) : (
                <FlashlightOff className="h-4 w-4" />
              )}
              <span>{torchEnabled ? 'Light On' : 'Flashlight'}</span>
            </button>

            <button
              type="button"
              disabled={devices.length < 2}
              onClick={handleSwitchCamera}
              title={devices.length < 2 ? 'Single camera detected' : 'Switch Camera'}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/70 px-3.5 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap"
            >
              <SwitchCamera className="h-4 w-4" />
              <span>Switch</span>
            </button>
          </div>
        </div>
      </div>

      <ScanResultSheet
        item={activeResult}
        onClose={() => {
          setActiveResult(null);
          setIsScanningPaused(false);
        }}
        onToggleFavorite={handleToggleFavorite}
      />
    </div>
  );
};
