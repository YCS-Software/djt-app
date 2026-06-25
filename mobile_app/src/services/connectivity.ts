/**
 * connectivity — online/offline awareness (F2).
 * Uses @capacitor/network on device and falls back to the browser online/offline
 * events on the web. Exposes a current-status read and a subscription.
 */
import { Network } from '@capacitor/network';

export async function getOnline(): Promise<boolean> {
  try {
    const s = await Network.getStatus();
    return s.connected;
  } catch {
    return typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
  }
}

export function subscribeOnline(cb: (online: boolean) => void): () => void {
  let removed = false;
  let handle: { remove: () => void } | undefined;

  Network.addListener('networkStatusChange', (s) => cb(s.connected))
    .then((h) => { if (removed) h.remove(); else handle = h; })
    .catch(() => { /* native unavailable — rely on window events */ });

  const onOnline = () => cb(true);
  const onOffline = () => cb(false);
  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
  }

  return () => {
    removed = true;
    handle?.remove();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    }
  };
}
