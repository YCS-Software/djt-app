/**
 * QrScanModal — live camera QR scanner (html5-qrcode).
 * Only accepts DJT machine codes (the signed `DJTEV1.` token); any other QR is
 * rejected with a message and scanning continues. The token is handed back via
 * onResult for the app to resolve server-side.
 */
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { useBackHandler } from '../services/backHandler';
import './QrScanModal.css';

const READER_ID = 'djt-qr-reader';
const TOKEN_PREFIX = 'DJTEV1.';

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
    const scanner = new Html5Qrcode(READER_ID, { verbose: false });
    scannerRef.current = scanner;

    const onDecoded = (text: string) => {
      if (handledRef.current) return;
      const value = (text || '').trim();
      // Accept the signed app token (preferred) OR a sticker/QR that encodes the
      // charger ws-url or a bare DJT OCPP id — the server resolves all three.
      const isToken = value.startsWith(TOKEN_PREFIX);
      const isWsOrOcpp = /\/ocpp\/[^/?#\s]+/i.test(value) || /^DJT-\d+-CP\d+-[A-Za-z0-9]+$/i.test(value);
      if (!isToken && !isWsOrOcpp) {
        setNotice('Not a DJT charger code — scan the QR on the machine');
        return;
      }
      handledRef.current = true;
      stop().finally(() => onResult(value));
    };

    scanner
      .start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, onDecoded, () => {})
      .then(() => { if (!cancelled) setStarting(false); })
      .catch((e: any) => {
        if (cancelled) return;
        setStarting(false);
        const msg = String(e?.message || e);
        setError(/permission|notallowed/i.test(msg)
          ? 'Camera permission denied. Allow camera access to scan.'
          : 'Unable to start the camera on this device.');
      });

    const stop = async () => {
      try {
        if (scanner.isScanning) await scanner.stop();
        scanner.clear();
      } catch { /* already stopped */ }
    };

    return () => { cancelled = true; stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="qs-overlay" onClick={onClose}>
      <div className="qs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qs-head">
          <h3>Scan charger QR</h3>
          <button className="qs-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {error ? (
          <div className="qs-alert qs-alert-error"><AlertTriangle size={16} /> <span>{error}</span></div>
        ) : (
          <>
            <div className="qs-frame">
              <div id={READER_ID} className="qs-reader" />
              {starting && <div className="qs-loading"><Loader2 className="qs-spin" size={22} /> Starting camera…</div>}
            </div>
            <p className="qs-hint">Point the camera at the QR code on the charger.</p>
            {notice && <div className="qs-alert qs-alert-warn"><AlertTriangle size={16} /> <span>{notice}</span></div>}
          </>
        )}
      </div>
    </div>
  );
}
