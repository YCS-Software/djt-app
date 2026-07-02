/**
 * ConnectorQrModal — per-connector QR. Each plug/connector has its own signed,
 * app-only QR (encodes the connector id + code, OCPP id, WS URL and price).
 * Renders a preview, downloads a printable label to device storage, and shares.
 */
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { ownerService } from '../services/api';
import type { ConnectorQr } from '../services/api/ownerService';
import { useBackHandler } from '../services/backHandler';
import { MediaSaver } from '../services/mediaSaver';
import { X, Download, Loader2, Hash, Wifi, IndianRupee, Plug, AlertTriangle, Check, Share2 } from 'lucide-react';

export default function ConnectorQrModal({ connectorId, onClose }: { connectorId: number; onClose: () => void }) {
  const [data, setData] = useState<ConnectorQr | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloaded, setDownloaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [saveErr, setSaveErr] = useState('');
  const previewRef = useRef<HTMLCanvasElement>(null);

  useBackHandler(true, onClose);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        setData(await ownerService.getConnectorQr(connectorId));
      } catch (e: any) {
        setError(e?.message || 'Failed to generate QR');
      } finally {
        setLoading(false);
      }
    })();
  }, [connectorId]);

  // Render the QR once data is loaded AND the canvas is mounted
  useEffect(() => {
    if (!data || !previewRef.current) return;
    QRCode.toCanvas(previewRef.current, data.token, {
      width: 200, margin: 1, errorCorrectionLevel: 'M',
      color: { dark: '#0A1626', light: '#FFFFFF' },
    }).catch((e: any) => setError(e?.message || 'Failed to render QR'));
  }, [data]);

  const label = () => data!.connector.code || data!.connector.name || `Connector ${data!.connector.connector_id}`;
  const filename = () => `DJT-QR-${data!.connector.code || data!.connector.connector_id}.png`;

  // Compose a printable connector label → PNG data URL
  const composeLabel = async (): Promise<string> => {
    const c = data!.connector;
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
        const pad = 40;
        ctx.fillStyle = '#FFFFFF';
        roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 28);
        ctx.fill();

        ctx.textAlign = 'center';
        ctx.fillStyle = '#0EA5C4';
        ctx.font = '700 30px Outfit, Arial, sans-serif';
        ctx.fillText('DJT POWER TECH', W / 2, 128);
        ctx.fillStyle = '#0A1626';
        ctx.font = '800 42px Outfit, Arial, sans-serif';
        ctx.fillText(truncate(label(), 24), W / 2, 186);
        ctx.fillStyle = '#5A6B7B';
        ctx.font = '500 25px Outfit, Arial, sans-serif';
        ctx.fillText(truncate(`${c.machine_name} · ${c.station_name}`, 34), W / 2, 226);

        const qrSize = 460;
        ctx.drawImage(img, (W - qrSize) / 2, 276, qrSize, qrSize);

        ctx.fillStyle = '#0A1626';
        ctx.font = '700 30px Outfit, Arial, sans-serif';
        ctx.fillText('Scan with the DJT app to charge', W / 2, 796);

        ctx.fillStyle = '#5A6B7B';
        ctx.font = '500 24px Outfit, Arial, sans-serif';
        ctx.fillText(`Connector · ${c.type}`, W / 2, 846);
        ctx.fillText(`₹${c.price_per_kwh}/kWh`, W / 2, 884);
        if (c.ocpp_id) {
          ctx.fillStyle = '#94A3B8';
          ctx.font = '500 20px monospace';
          ctx.fillText(`OCPP: ${c.ocpp_id}`, W / 2, 922);
        }
        resolve(cv.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to render QR image'));
      img.src = qrUrl;
    });
  };

  const download = async () => {
    if (!data || saving) return;
    setSaving(true); setSaveErr(''); setSavedMsg('');
    try {
      const dataUrl = await composeLabel();
      if (Capacitor.isNativePlatform()) {
        await MediaSaver.saveImage({ base64: dataUrl.split(',')[1], filename: filename(), mimeType: 'image/png' });
        setSavedMsg('Saved to Downloads');
        setDownloaded(true);
      } else {
        const link = document.createElement('a');
        link.download = filename(); link.href = dataUrl;
        document.body.appendChild(link); link.click(); link.remove();
        setSavedMsg('Downloaded'); setDownloaded(true);
      }
      setTimeout(() => { setDownloaded(false); setSavedMsg(''); }, 3500);
    } catch (e: any) {
      setSaveErr(e?.message || 'Could not save the QR code');
    } finally {
      setSaving(false);
    }
  };

  const share = async () => {
    if (!data || sharing) return;
    setSharing(true); setSaveErr('');
    try {
      const dataUrl = await composeLabel();
      if (Capacitor.isNativePlatform()) {
        const written = await Filesystem.writeFile({
          path: filename(), data: dataUrl.split(',')[1], directory: Directory.Cache, recursive: true,
        });
        await Share.share({ title: 'Connector QR', text: `${label()} — scan with the DJT app to charge`, files: [written.uri] });
      } else if ((navigator as any).share) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], filename(), { type: 'image/png' });
        const nav: any = navigator;
        if (nav.canShare && nav.canShare({ files: [file] })) await nav.share({ files: [file], title: 'Connector QR' });
        else await nav.share({ title: 'Connector QR', text: label() });
      } else {
        await download();
      }
    } catch (e: any) {
      if (e?.message && !/cancel|abort|dismiss/i.test(e.message)) setSaveErr(e.message);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="owner-modal-overlay" onClick={onClose}>
      <div className="owner-modal" onClick={(e) => e.stopPropagation()}>
        <div className="owner-modal-head">
          <h3><Plug size={17} /> Connector QR</h3>
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
            {!data.connector.configured && (
              <div className="owner-alert owner-alert-warning">
                <AlertTriangle size={16} />
                <span>This charger has no OCPP ID yet — configure it so the connector can go online.</span>
              </div>
            )}
            <div className="owner-qr-preview">
              <canvas ref={previewRef} width={200} height={200} />
            </div>
            <div className="owner-qr-name">{label()}</div>
            <div className="owner-qr-station">{data.connector.machine_name} · {data.connector.station_name}</div>

            <div className="owner-qr-rows">
              <div className="owner-qr-row"><span><Plug size={13} /> Connector</span><b>{data.connector.type}</b></div>
              <div className="owner-qr-row"><span><Hash size={13} /> OCPP ID</span><b>{data.connector.ocpp_id || '—'}</b></div>
              <div className="owner-qr-row"><span><Wifi size={13} /> WebSocket</span><b className="owner-ocpp-url owner-ellipsis">{data.connector.ws_url || '—'}</b></div>
              <div className="owner-qr-row"><span><IndianRupee size={13} /> Price</span><b>₹{data.connector.price_per_kwh}/kWh</b></div>
            </div>

            <p className="owner-field-hint">This QR works only inside the DJT app — generic scanners can't use it.</p>

            {saveErr && <div className="owner-alert owner-alert-error">{saveErr}</div>}

            <button className="owner-btn owner-btn-primary owner-btn-block" onClick={download} disabled={saving}>
              {saving ? <><Loader2 className="owner-spin" size={16} /> Saving…</>
                : downloaded ? <><Check size={16} /> {savedMsg || 'Saved'}</>
                : <><Download size={16} /> Download QR</>}
            </button>
            {downloaded && savedMsg === 'Saved to Downloads' && (
              <p className="owner-field-hint owner-qr-saved">Saved as <b>{filename()}</b> in <b>Downloads/DJT</b>.</p>
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
