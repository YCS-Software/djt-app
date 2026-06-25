/**
 * OfflineBanner — global, theme-independent connectivity strip (F2).
 * Shows "No internet connection" while offline, and a brief "Back online" when
 * connectivity returns (also fires a `djt:online` event so screens can refetch).
 */
import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { getOnline, subscribeOnline } from '../services/connectivity';
import './OfflineBanner.css';

export default function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    let mounted = true;
    getOnline().then((o) => { if (mounted) setOnline(o); });

    const unsub = subscribeOnline((o) => {
      setOnline((prev) => {
        if (!prev && o) {
          // transitioned offline → online
          setShowBackOnline(true);
          setTimeout(() => setShowBackOnline(false), 2500);
          try { window.dispatchEvent(new CustomEvent('djt:online')); } catch { /* ignore */ }
        }
        return o;
      });
    });

    return () => { mounted = false; unsub(); };
  }, []);

  if (online && !showBackOnline) return null;

  return (
    <div className={`net-banner ${online ? 'net-online' : 'net-offline'}`} role="status" aria-live="polite">
      {online ? <><Wifi size={14} /> Back online</> : <><WifiOff size={14} /> No internet connection</>}
    </div>
  );
}
