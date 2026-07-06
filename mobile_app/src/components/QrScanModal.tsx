/**
 * QrScanModal — live camera QR scanner (html5-qrcode).
 * Only accepts DJT machine codes (the signed `DJTEV1.` token); any other QR is
 * rejected with a message and scanning continues. The token is handed back via
 * onResult for the app to resolve server-side.
 */
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, AlertTriangle, Loader2, ScanLine, QrCode } from 'lucide-react';
import { useBackHandler } from '../services/backHandler';
import './QrScanModal.css';

const READER_ID = 'djt-qr-reader';
const TOKEN_PREFIX = 'DJTEV1.';

// Tagged logger so you can filter the Chrome DevTools console by "[QR]".
const qlog = (...a: unknown[]) => console.log('[QR]', ...a);

export default function QrScanModal({ onResult, onClose }: { onResult: (token: string) => void; onClose: () => void }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [starting, setStarting] = useState(true);

  // Hardware Back closes the scanner (and stops the camera via unmount) (F7)
  useBackHandler(true, onClose);

  useEffect(() => {
    let cancelled = false;
    qlog('modal mounted — initializing scanner');
    // NOTE: we deliberately do NOT enable experimentalFeatures.useBarCodeDetectorIfSupported.
    // On this Samsung WebView (and others) that native path processes frames but
    // never returns a successful decode — verified via device logs: 300+ frames
    // processed, zero decodes. The bundled zxing JS decoder decodes reliably; the
    // large qrbox below gives the alignment tolerance we want.
    const scanner = new Html5Qrcode(READER_ID, { verbose: false });
    scannerRef.current = scanner;

    const onDecoded = (text: string) => {
      qlog('DECODED raw value:', JSON.stringify(text));
      if (handledRef.current) { qlog('…ignored (already handled)'); return; }
      const value = (text || '').trim();
      // Accept the signed app token (preferred) OR a sticker/QR that encodes the
      // charger ws-url or a bare DJT OCPP id — the server resolves all three.
      const isToken = value.startsWith(TOKEN_PREFIX);
      const isWsOrOcpp = /\/ocpp\/[^/?#\s]+/i.test(value) || /^DJT-\d+-CP\d+-[A-Za-z0-9]+$/i.test(value);
      qlog('classify →', { isToken, isWsOrOcpp });
      if (!isToken && !isWsOrOcpp) {
        qlog('REJECTED — not a DJT charger code');
        setNotice('Not a DJT charger code — scan the QR on the machine');
        return;
      }
      qlog('ACCEPTED — handing token to app:', value);
      handledRef.current = true;
      stop().finally(() => onResult(value));
    };

    // Per-frame "no QR found" callback. html5-qrcode calls this many times a
    // second while the camera runs — throttle to prove the scan loop is ALIVE
    // (if you never see this line, the camera never started).
    let lastTick = 0;
    let frames = 0;
    const onScanFailure = () => {
      frames++;
      const t = Date.now();
      if (t - lastTick > 2000) {
        lastTick = t;
        qlog(`scanning… camera live, ${frames} frames processed, still searching for a QR`);
      }
    };

    // High-resolution + continuous autofocus. A low-res or out-of-focus frame
    // makes a dense QR unreadable no matter how well aimed — the usual reason a
    // live camera "scans" forever without decoding. These rich constraints MUST
    // go through `videoConstraints` (html5-qrcode requires the first start() arg
    // to have exactly one key), and the validator allows all of these.
    const HI_RES = {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      // `advanced`/focusMode aren't in the TS DOM types but Android Chrome honours them.
      advanced: [{ focusMode: 'continuous' }],
    };

    // Log what camera we actually got (resolution/focus) — a tiny resolution here
    // explains a persistent no-decode.
    const logTrack = () => {
      try {
        const s = (scanner as any).getRunningTrackSettings?.();
        if (s) qlog('camera track settings:', JSON.stringify({ w: s.width, h: s.height, fps: s.frameRate, facing: s.facingMode }));
        // The DECODE canvas is capped at the on-screen video size (CSS px) — log
        // it to confirm the fullscreen viewfinder gives us enough resolution.
        const v = document.querySelector(`#${READER_ID} video`) as HTMLVideoElement | null;
        if (v) qlog(`viewfinder (decode canvas ceiling) ${v.clientWidth}x${v.clientHeight} css-px`);
      } catch { /* not fatal */ }
    };

    // Start the camera. First arg = single-key selector (required, but ignored
    // once videoConstraints is supplied); videoConstraints carries the real
    // request. NOTE: no `qrbox` → html5-qrcode scans the FULL frame, so aim no
    // longer has to be pixel-perfect (this was the "100% precision" pain point).
    const startWith = (selector: object, video: object) =>
      scanner.start(selector as any, { fps: 10, videoConstraints: video as any }, onDecoded, onScanFailure);

    (async () => {
      try {
        qlog('starting camera with facingMode=environment…');
        await startWith({ facingMode: 'environment' }, { facingMode: 'environment', ...HI_RES });
        if (!cancelled) { qlog('camera STARTED ok (environment)'); logTrack(); setStarting(false); }
      } catch (e1: any) {
        qlog('environment start FAILED:', String(e1?.message || e1));
        if (cancelled) return;
        // Fallback: enumerate cameras and try the last device explicitly.
        try {
          const cams = await Html5Qrcode.getCameras();
          qlog('enumerated cameras:', cams.map((c) => ({ id: c.id, label: c.label })));
          if (!cams.length) throw new Error('no cameras found');
          const back = cams[cams.length - 1];
          qlog('retrying with deviceId:', back.id, back.label);
          await startWith({ deviceId: back.id }, { deviceId: { exact: back.id }, ...HI_RES });
          if (!cancelled) { qlog('camera STARTED ok (deviceId fallback)'); logTrack(); setStarting(false); }
        } catch (e2: any) {
          if (cancelled) return;
          const msg = String(e2?.message || e1?.message || e2 || e1);
          qlog('camera start FAILED (both attempts):', msg);
          setStarting(false);
          setError(/permission|notallowed|denied/i.test(msg)
            ? 'Camera permission denied. Allow camera access to scan.'
            : 'Unable to start the camera on this device.');
        }
      }
    })();

    const stop = async () => {
      try {
        if (scanner.isScanning) { qlog('stopping camera'); await scanner.stop(); }
        scanner.clear();
      } catch (e) { qlog('stop() ignored error:', String((e as any)?.message || e)); }
    };

    return () => { qlog('modal unmounting — stopping camera'); cancelled = true; stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="qs-overlay" onClick={onClose}>
      <div className="qs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qs-head">
          <div className="qs-title">
            <span className="qs-title-icon"><ScanLine size={18} /></span>
            <div>
              <h3>Scan charger QR</h3>
              <p className="qs-sub">Align the code within the frame</p>
            </div>
          </div>
          <button className="qs-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {error ? (
          <div className="qs-alert qs-alert-error"><AlertTriangle size={16} /> <span>{error}</span></div>
        ) : (
          <>
            <div className="qs-frame">
              <div id={READER_ID} className="qs-reader" />
              {/* Decorative aiming guide — pointer-events:none, does not affect the
                  full-frame decode (html5-qrcode reads raw <video> frames). */}
              <div className="qs-guide" aria-hidden="true">
                <div className="qs-window">
                  <span className="qs-corner tl" />
                  <span className="qs-corner tr" />
                  <span className="qs-corner bl" />
                  <span className="qs-corner br" />
                  <span className="qs-scanline" />
                </div>
              </div>
              {starting && <div className="qs-loading"><Loader2 className="qs-spin" size={22} /> Starting camera…</div>}
            </div>
            <p className="qs-hint"><QrCode size={14} /> Point the camera at the QR code on the charger.</p>
            {notice && <div className="qs-alert qs-alert-warn"><AlertTriangle size={16} /> <span>{notice}</span></div>}
          </>
        )}
      </div>
    </div>
  );
}
