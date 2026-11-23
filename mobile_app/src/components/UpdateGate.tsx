/**
 * UpdateGate — shows the result of the server-controlled update check.
 *   required    → full-screen, cannot be dismissed
 *   unreachable → full-screen with Retry (auto-retries in the background)
 * Renders nothing when the app is up to date.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { DownloadCloud, ServerCrash, RefreshCw } from 'lucide-react';
import { checkForUpdate, openUpdateUrl } from '../services/appVersion';
import type { UpdateCheck } from '../services/appVersion';
import './UpdateGate.css';

const RETRY_MS = 15000;

export default function UpdateGate() {
  const [check, setCheck] = useState<UpdateCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const busy = useRef(false);

  const run = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    try {
      setCheck(await checkForUpdate());
    } finally {
      busy.current = false;
      setChecking(false);
    }
  }, []);

  // Check on launch, when the app returns to the foreground, and when the
  // connection comes back.
  useEffect(() => {
    run();
    const onOnline = () => { run(); };
    window.addEventListener('djt:online', onOnline);
    let remove: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener('appStateChange', (s) => { if (s.isActive) run(); })
        .then((h) => { remove = () => h.remove(); })
        .catch(() => { /* plugin unavailable */ });
    }
    return () => {
      window.removeEventListener('djt:online', onOnline);
      remove?.();
    };
  }, [run]);

  // While the server is unreachable keep trying quietly, so the screen clears
  // by itself as soon as the server is back.
  useEffect(() => {
    if (check?.status !== 'unreachable') return;
    const id = setInterval(run, RETRY_MS);
    return () => clearInterval(id);
  }, [check?.status, run]);

  if (!check || check.status === 'ok') return null;

  const versionLine = `Installed version ${check.installed.name} (${check.installed.code})`;

  if (check.status === 'required') {
    return (
      <div className="update-gate" role="alertdialog" aria-modal="true" aria-labelledby="update-gate-title" data-testid="update-required">
        <div className="update-gate-card">
          <div className="update-gate-icon"><DownloadCloud size={36} /></div>
          <h1 id="update-gate-title">Update required</h1>
          <p>
            This version of DJT HAIKA is no longer supported. Please update to continue charging.
          </p>
          <button className="update-gate-primary" onClick={() => openUpdateUrl(check.updateUrl)}>
            Update now
          </button>
          <span className="update-gate-version">{versionLine}</span>
        </div>
      </div>
    );
  }

  // unreachable
  return (
    <div className="update-gate" role="alertdialog" aria-modal="true" aria-labelledby="update-gate-title" data-testid="server-unreachable">
      <div className="update-gate-card">
        <div className="update-gate-icon update-gate-icon-warn"><ServerCrash size={36} /></div>
        <h1 id="update-gate-title">Can&apos;t reach the server</h1>
        <p>
          Your internet is working, but DJT HAIKA could not connect to our server.
          Please try again. If this keeps happening, your app may be out of date.
        </p>
        <button className="update-gate-primary" onClick={run} disabled={checking}>
          <RefreshCw size={18} className={checking ? 'update-gate-spin' : ''} />
          {checking ? 'Trying…' : 'Try again'}
        </button>
        <button className="update-gate-secondary" onClick={() => openUpdateUrl(check.updateUrl)}>
          Check for an update
        </button>
        <span className="update-gate-version">{versionLine}</span>
      </div>
    </div>
  );
}
