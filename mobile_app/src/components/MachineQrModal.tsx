/**
 * MachineQrModal — fetches a machine's signed QR token, renders the QR, and
 * downloads it as a professional printable label (PNG). The QR encodes an
 * app-only token, so only the DJT app (via the server) can act on it.
 */
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { ownerService } from '../services/api';
import type { MachineQr } from '../services/api/ownerService';
import { useBackHandler } from '../services/backHandler';
import { MediaSaver } from '../services/mediaSaver';
import { X, Download, Loader2, Hash, Wifi, IndianRupee, AlertTriangle, Check, Share2 } from 'lucide-react';

export default function MachineQrModal({ machineId, onClose }: { machineId: number; onClose: () => void }) {
  const [data, setData] = useState<MachineQr | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloaded, setDownloaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [saveErr, setSaveErr] = useState('');
  const previewRef = useRef<HTMLCanvasElement>(null);

  // Hardware Back closes this modal instead of leaving the page (F7)
  useBackHandler(true, onClose);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const qr = await ownerService.getMachineQr(machineId);
        setData(qr);
      } catch (e: any) {
        setError(e?.message || 'Failed to generate QR');
      } finally {
        setLoading(false);
      }
    })();
  }, [machineId]);

  // Render the QR ONCE the data is loaded AND the canvas is mounted. Doing this
  // inside the fetch effect raced the canvas mount (previewRef.current was null),
  // which is why the QR rendered in dev but not in production builds.
  useEffect(() => {
    if (!data || !previewRef.current) return;
    QRCode.toCanvas(previewRef.current, data.token, {
      width: 200, margin: 1, errorCorrectionLevel: 'M',
      color: { dark: '#0A1626', light: '#FFFFFF' },
    }).catch((e: any) => setError(e?.message || 'Failed to render QR'));
  }, [data]);

  // Compose the printable label (title + station + QR + footer) → PNG data URL
  const composeLabel = async (): Promise<string> => {
    const m = data!.machine;
    const qrUrl = await QRCode.toDataURL(data!.token, {
      width: 620, margin: 1, errorCorrectionLevel: 'M',
      color: { dark: '#0A1626', light: '#FFFFFF' },
    });
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const W = 760, H = 1000;
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const ctx = cv.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }

        ctx.fillStyle = '#0B1A2E';
        ctx.fillRect(0, 0, W, H);
        const pad = 40, cardW = W - pad * 2, cardH = H - pad * 2;
        ctx.fillStyle = '#FFFFFF';
        roundRect(ctx, pad, pad, cardW, cardH, 28);
        ctx.fill();

        ctx.textAlign = 'center';
        ctx.fillStyle = '#0EA5C4';
        ctx.font = '700 30px Outfit, Arial, sans-serif';
        ctx.fillText('DJT POWER TECH', W / 2, 130);
        ctx.fillStyle = '#0A1626';
        ctx.font = '800 44px Outfit, Arial, sans-serif';
        ctx.fillText(truncate(m.name, 22), W / 2, 190);
        ctx.fillStyle = '#5A6B7B';
        ctx.font = '500 26px Outfit, Arial, sans-serif';
        ctx.fillText(truncate(m.station_name, 30), W / 2, 232);

        const qrSize = 460;
        ctx.drawImage(img, (W - qrSize) / 2, 280, qrSize, qrSize);

        ctx.fillStyle = '#0A1626';
        ctx.font = '700 30px Outfit, Arial, sans-serif';
        ctx.fillText('Scan with the DJT app to charge', W / 2, 800);

        ctx.fillStyle = '#5A6B7B';
        ctx.font = '500 24px Outfit, Arial, sans-serif';
        const power = m.power_label ? `${m.machine_type} · ${m.power_label}` : m.machine_type;
        ctx.fillText(power, W / 2, 850);
        ctx.fillText(`₹${m.price_per_kwh}/kWh`, W / 2, 888);
        if (m.ocpp_id) {
          ctx.fillStyle = '#94A3B8';
          ctx.font = '500 20px monospace';
          ctx.fillText(`OCPP: ${m.ocpp_id}`, W / 2, 926);
        }
        resolve(cv.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to render QR image'));
      img.src = qrUrl;
    });
  };

  const filename = () => `DJT-QR-${data!.machine.ocpp_id || data!.machine.machine_id}.png`;

  // DOWNLOAD: save the PNG to device storage (Documents) — no share sheet.
  const download = async () => {
    if (!data || saving) return;
    setSaving(true);
    setSaveErr('');
    setSavedMsg('');
    try {
      const dataUrl = await composeLabel();
      if (Capacitor.isNativePlatform()) {
        // Native MediaStore save → public Downloads/DJT (no permission on A10+)
        const base64 = dataUrl.split(',')[1];
        await MediaSaver.saveImage({ base64, filename: filename(), mimeType: 'image/png' });
        setSavedMsg('Saved to Downloads');
        setDownloaded(true);
      } else {
        const link = document.createElement('a');
        link.download = filename();
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setSavedMsg('Downloaded');
        setDownloaded(true);
      }
      setTimeout(() => { setDownloaded(false); setSavedMsg(''); }, 3500);
    } catch (e: any) {
      setSaveErr(e?.message || 'Could not save the QR code');
    } finally {
      setSaving(false);
    }
  };

  // SHARE: open the system share sheet with the PNG (separate from download).
  const share = async () => {
    if (!data || sharing) return;
    setSharing(true);
    setSaveErr('');
    try {
      const dataUrl = await composeLabel();
      if (Capacitor.isNativePlatform()) {
        const base64 = dataUrl.split(',')[1];
        // write a temp copy to the cache dir, then share that file
        const written = await Filesystem.writeFile({
          path: filename(),
          data: base64,
          directory: Directory.Cache,
          recursive: true,
        });
        await Share.share({
          title: 'Machine QR',
          text: `${data.machine.name} — scan with the DJT app to charge`,
          files: [written.uri],
        });
      } else if ((navigator as any).share) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], filename(), { type: 'image/png' });
        const nav: any = navigator;
        if (nav.canShare && nav.canShare({ files: [file] })) {
          await nav.share({ files: [file], title: 'Machine QR' });
        } else {
          await nav.share({ title: 'Machine QR', text: data.machine.name });
        }
      } else {
        // no share support on web → fall back to a download
        await download();
      }
    } catch (e: any) {
      // ignore user-cancelled share
      if (e?.message && !/cancel|abort|dismiss/i.test(e.message)) {
        setSaveErr(e.message);
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="owner-modal-overlay" onClick={onClose}>
      <div className="owner-modal" onClick={(e) => e.stopPropagation()}>
        <div className="owner-modal-head">
          <h3><Hash size={17} /> Machine QR</h3>
          <div className="owner-qr-head-actions">
            {data && (
              <button className="owner-icon-btn" onClick={share} disabled={sharing} title="Share QR" aria-label="Share QR">
                {sharing ? <Loader2 className="owner-spin" size={18} /> : <Share2 size={18} />}
              </button>
            )}
            <button className="owner-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
          </div>
        </div>

        {loading ? (
          <div className="owner-loading"><Loader2 className="owner-spin" size={24} /> Generating…</div>
        ) : error ? (
          <div className="owner-alert owner-alert-error">{error}</div>
        ) : data ? (
          <>
            {!data.machine.configured && (
              <div className="owner-alert owner-alert-warning">
                <AlertTriangle size={16} />
                <span>This machine has no OCPP ID yet — configure it so the charger can connect.</span>
              </div>
            )}
            <div className="owner-qr-preview">
              <canvas ref={previewRef} width={200} height={200} />
            </div>
            <div className="owner-qr-name">{data.machine.name}</div>
            <div className="owner-qr-station">{data.machine.station_name}</div>

            <div className="owner-qr-rows">
              <div className="owner-qr-row"><span><Hash size={13} /> OCPP ID</span><b>{data.machine.ocpp_id || '—'}</b></div>
              <div className="owner-qr-row"><span><Wifi size={13} /> WebSocket</span><b className="owner-ocpp-url owner-ellipsis">{data.machine.ws_url || '—'}</b></div>
              <div className="owner-qr-row"><span><IndianRupee size={13} /> Price</span><b>₹{data.machine.price_per_kwh}/kWh</b></div>
            </div>

            <p className="owner-field-hint">This QR works only inside the DJT app — generic scanners can't use it.</p>

            {saveErr && <div className="owner-alert owner-alert-error">{saveErr}</div>}

            <button className="owner-btn owner-btn-primary owner-btn-block" onClick={download} disabled={saving}>
              {saving ? <><Loader2 className="owner-spin" size={16} /> Saving…</>
                : downloaded ? <><Check size={16} /> {savedMsg || 'Saved'}</>
                : <><Download size={16} /> Download QR</>}
            </button>
            {downloaded && savedMsg === 'Saved to Downloads' && (
              <p className="owner-field-hint owner-qr-saved">Saved as <b>{`DJT-QR-${data.machine.ocpp_id || data.machine.machine_id}.png`}</b> in <b>Downloads/DJT</b>.</p>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncate(s: string, n: number) {
  return s && s.length > n ? s.slice(0, n - 1) + '…' : s;
}
