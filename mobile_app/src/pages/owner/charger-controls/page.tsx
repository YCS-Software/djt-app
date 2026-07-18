import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Toast } from '@capacitor/toast';
import { ownerService } from '../../../services/api';
import type { MachineProfile, ChargerCommandResult, ChargerConfigKey } from '../../../services/api/ownerService';
import {
  ArrowLeft, Loader2, Building2, Wifi, WifiOff, RotateCcw, Power, Eraser,
  Unlock, RefreshCw, AlertTriangle, Plug, ShieldOff, ShieldCheck,
  ListChecks, FileText, Download, Lock,
} from 'lucide-react';

// A pending confirmation (the actual OCPP call fires only on confirm).
interface Pending {
  title: string;
  message: string;
  danger?: boolean;
  label: string;
  run: () => Promise<ChargerCommandResult>;
}

export default function ChargerControlsPage() {
  const navigate = useNavigate();
  const { machineId } = useParams();
  const mid = Number(machineId);

  const [data, setData] = useState<MachineProfile | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [configModal, setConfigModal] = useState<null | { loading: boolean; keys?: ChargerConfigKey[]; error?: string }>(null);
  const [formModal, setFormModal] = useState<null | { kind: 'diagnostics' | 'firmware'; location: string; retrieveDate: string }>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const profile = await ownerService.getMachineProfile(mid);
      setData(profile);
      if (profile.machine.ocpp_id) {
        const conns = await ownerService.getOcppConnections().catch(() => []);
        setOnline(conns.some((c) => c.ocpp_id === profile.machine.ocpp_id));
      } else {
        setOnline(false);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load charger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [mid]);

  const notify = async (message: string) => {
    try { await Toast.show({ text: message, duration: 'long' }); } catch { alert(message); }
  };

  // Execute a confirmed command and surface the charger's ack.
  const execute = async (key: string, label: string, fn: () => Promise<ChargerCommandResult>) => {
    setPending(null);
    setBusy(key);
    try {
      const res = await fn();
      const status = res?.result?.status || 'Sent';
      const ok = /accept|unlock|sched|success/i.test(status);
      await notify(`${label}: ${status}${ok ? '' : ' — charger did not accept'}`);
      // A reset/availability change may flip connectivity; refresh shortly after.
      setTimeout(() => { load().catch(() => {}); }, 2500);
    } catch (e: any) {
      await notify(e?.message || `${label} failed`);
    } finally {
      setBusy(null);
    }
  };

  const ask = (p: Pending) => setPending(p);

  // GetConfiguration — reads the charger's config keys and shows them in a modal.
  const viewConfig = async () => {
    if (!ocppId) return;
    setBusy('config');
    setConfigModal({ loading: true });
    try {
      const res = await ownerService.chargerGetConfiguration(ocppId);
      setConfigModal({ loading: false, keys: res?.result?.configurationKey || [] });
    } catch (e: any) {
      setConfigModal({ loading: false, error: e?.message || 'Failed to read configuration' });
    } finally {
      setBusy(null);
    }
  };

  // Submit the Diagnostics / Firmware form (both take a location URL).
  const submitForm = async () => {
    if (!formModal || !ocppId) return;
    const loc = formModal.location.trim();
    if (!loc) return;
    const kind = formModal.kind;
    const retrieveDate = formModal.retrieveDate;
    setFormModal(null);
    setBusy(kind);
    try {
      if (kind === 'diagnostics') {
        const res = await ownerService.chargerGetDiagnostics(ocppId, { location: loc });
        const fn = res?.result?.fileName;
        await notify(`Diagnostics upload requested${fn ? ` — ${fn}` : ''}`);
      } else {
        const iso = retrieveDate ? new Date(retrieveDate).toISOString() : undefined;
        await ownerService.chargerUpdateFirmware(ocppId, { location: loc, retrieve_date: iso });
        await notify('Firmware update requested — the charger will download & install.');
      }
    } catch (e: any) {
      await notify(e?.message || `${kind} request failed`);
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="owner-page"><div className="owner-loading"><Loader2 className="owner-spin" size={26} /> Loading…</div></div>;
  }
  if (error || !data) {
    return (
      <div className="owner-page owner-animate-in">
        <div className="owner-page-head">
          <button className="owner-back" onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
          <div className="owner-head-grow"><h1 className="owner-h1">Charger Controls</h1></div>
        </div>
        <div className="owner-alert owner-alert-error">{error || 'Charger not found'}</div>
      </div>
    );
  }

  const { machine: m, connectors } = data;
  const ocppId = m.ocpp_id;
  const disabled = !ocppId || !online || busy != null;
  const cs = !ocppId ? 'unconfigured' : online ? 'online' : 'offline';
  const csLabel = cs === 'online' ? 'Online' : cs === 'offline' ? 'Offline' : 'Not configured';

  return (
    <div className="owner-page owner-animate-in">
      <div className="owner-page-head">
        <button className="owner-back" onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
        <div className="owner-head-grow">
          <h1 className="owner-h1 owner-ellipsis">Charger Controls</h1>
          <p className="owner-sub owner-ellipsis"><Building2 size={12} /> {m.name} · {m.station_name}</p>
        </div>
        <span className={`owner-conn owner-conn-${cs}`}>
          {cs === 'online' ? <Wifi size={11} /> : <WifiOff size={11} />}
          <span className="owner-conn-dot" /> {csLabel}
        </span>
      </div>

      {!ocppId && <div className="owner-alert owner-alert-warn">This charger has no OCPP ID configured — remote controls are unavailable.</div>}
      {ocppId && !online && <div className="owner-alert owner-alert-warn">Charger is offline. Controls will work once it reconnects.</div>}

      {/* Power / maintenance */}
      <div className="owner-section-head"><h2 className="owner-h2">Power &amp; Maintenance</h2></div>
      <div className="owner-card owner-ctrl-list">
        <div className="owner-ctrl-row">
          <span className="owner-ctrl-icon tone-amber"><RotateCcw size={17} /></span>
          <div className="owner-ctrl-main">
            <div className="owner-ctrl-title">Soft Reset</div>
            <div className="owner-ctrl-sub">Graceful restart — finishes any active session first.</div>
          </div>
          <button className="owner-btn owner-btn-ghost owner-btn-sm" disabled={disabled}
            onClick={() => ask({ title: 'Soft reset charger?', message: 'The charger will restart gracefully. Any active session finishes first.', label: 'Soft reset', run: () => ownerService.chargerReset(ocppId!, 'Soft') })}>
            {busy === 'soft-reset' ? <Loader2 className="owner-spin" size={15} /> : <RotateCcw size={15} />} Soft
          </button>
        </div>
        <div className="owner-ctrl-row">
          <span className="owner-ctrl-icon tone-red"><Power size={17} /></span>
          <div className="owner-ctrl-main">
            <div className="owner-ctrl-title">Hard Reset</div>
            <div className="owner-ctrl-sub">Full reboot (power-cycle). Drops any active session immediately.</div>
          </div>
          <button className="owner-btn owner-btn-danger owner-btn-sm" disabled={disabled}
            onClick={() => ask({ title: 'Hard reset charger?', message: 'This reboots the charger immediately and drops any active session. Use only if the charger is stuck.', danger: true, label: 'Hard reset', run: () => ownerService.chargerReset(ocppId!, 'Hard') })}>
            {busy === 'hard-reset' ? <Loader2 className="owner-spin" size={15} /> : <Power size={15} />} Hard
          </button>
        </div>
        <div className="owner-ctrl-row">
          <span className="owner-ctrl-icon tone-violet"><Eraser size={17} /></span>
          <div className="owner-ctrl-main">
            <div className="owner-ctrl-title">Clear Cache</div>
            <div className="owner-ctrl-sub">Clears the charger's local authorization cache.</div>
          </div>
          <button className="owner-btn owner-btn-ghost owner-btn-sm" disabled={disabled}
            onClick={() => ask({ title: 'Clear charger cache?', message: 'Clears the local authorization cache on the charger.', label: 'Clear cache', run: () => ownerService.chargerClearCache(ocppId!) })}>
            Clear
          </button>
        </div>
        <div className="owner-ctrl-row">
          <span className="owner-ctrl-icon tone-cyan"><RefreshCw size={17} /></span>
          <div className="owner-ctrl-main">
            <div className="owner-ctrl-title">Refresh Status</div>
            <div className="owner-ctrl-sub">Ask the charger to re-send its current StatusNotification.</div>
          </div>
          <button className="owner-btn owner-btn-ghost owner-btn-sm" disabled={disabled}
            onClick={() => execute('trigger', 'Refresh status', () => ownerService.chargerTriggerMessage(ocppId!, 'StatusNotification'))}>
            {busy === 'trigger' ? <Loader2 className="owner-spin" size={15} /> : <RefreshCw size={15} />} Refresh
          </button>
        </div>
      </div>

      {/* Whole-charger availability */}
      <div className="owner-section-head"><h2 className="owner-h2">Availability</h2></div>
      <div className="owner-card owner-ctrl-list">
        <div className="owner-ctrl-row owner-ctrl-stack">
          <span className="owner-ctrl-icon tone-green"><ShieldCheck size={17} /></span>
          <div className="owner-ctrl-main">
            <div className="owner-ctrl-title">Whole charger</div>
            <div className="owner-ctrl-sub">Put the entire charger in or out of service.</div>
          </div>
          <div className="owner-ctrl-actions">
            <button className="owner-btn owner-btn-ghost owner-btn-sm" disabled={disabled}
              onClick={() => ask({ title: 'Enable charger?', message: 'Set the whole charger Operative (in service).', label: 'Enable charger', run: () => ownerService.chargerChangeAvailability(ocppId!, 'Operative', 0) })}>
              <ShieldCheck size={14} /> Enable
            </button>
            <button className="owner-btn owner-btn-danger owner-btn-sm" disabled={disabled}
              onClick={() => ask({ title: 'Disable charger?', message: 'Set the whole charger Inoperative (out of service). Drivers will not be able to start here.', danger: true, label: 'Disable charger', run: () => ownerService.chargerChangeAvailability(ocppId!, 'Inoperative', 0) })}>
              <ShieldOff size={14} /> Disable
            </button>
          </div>
        </div>
      </div>

      {/* Per-connector: unlock + availability. OCPP connectorId = 1-based order. */}
      <div className="owner-section-head">
        <h2 className="owner-h2">Connectors</h2>
        <span className="owner-count-pill">{connectors.length}</span>
      </div>
      {connectors.length === 0 ? (
        <div className="owner-card owner-txn-empty"><Plug size={18} /> No connectors</div>
      ) : (
        <div className="owner-card owner-ctrl-list">
          {connectors.map((c, i) => {
            const ord = i + 1; // OCPP connectorId
            return (
              <div key={c.connector_id} className="owner-ctrl-row owner-ctrl-stack">
                <span className="owner-ctrl-icon tone-cyan"><Plug size={16} /></span>
                <div className="owner-ctrl-main">
                  <div className="owner-ctrl-title">
                    <span className="owner-ctrl-conn-name">{c.code || c.name || `Connector ${ord}`}</span>
                    <span className="owner-ctrl-ord">#{ord}</span>
                  </div>
                  <div className="owner-ctrl-sub">{c.type}{c.power ? ` · ${c.power}` : ''}</div>
                </div>
                <div className="owner-ctrl-actions">
                  <button className="owner-btn owner-btn-ghost owner-btn-xs" disabled={disabled}
                    onClick={() => ask({ title: `Unlock ${c.code || 'connector ' + ord}?`, message: 'Releases the cable lock on this connector.', label: 'Unlock', run: () => ownerService.chargerUnlockConnector(ocppId!, ord) })}>
                    <Unlock size={13} /> Unlock
                  </button>
                  <button className="owner-btn owner-btn-ghost owner-btn-xs" disabled={disabled}
                    onClick={() => ask({ title: `Enable connector ${ord}?`, message: 'Set this connector Operative (in service).', label: 'Enable connector', run: () => ownerService.chargerChangeAvailability(ocppId!, 'Operative', ord) })}>
                    <ShieldCheck size={13} /> Enable
                  </button>
                  <button className="owner-btn owner-btn-ghost owner-btn-xs" disabled={disabled}
                    onClick={() => ask({ title: `Disable connector ${ord}?`, message: 'Set this connector Inoperative (out of service).', danger: true, label: 'Disable connector', run: () => ownerService.chargerChangeAvailability(ocppId!, 'Inoperative', ord) })}>
                    <ShieldOff size={13} /> Disable
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Configuration & maintenance */}
      <div className="owner-section-head"><h2 className="owner-h2">Configuration &amp; Maintenance</h2></div>
      <div className="owner-card owner-ctrl-list">
        <div className="owner-ctrl-row">
          <span className="owner-ctrl-icon tone-cyan"><ListChecks size={17} /></span>
          <div className="owner-ctrl-main">
            <div className="owner-ctrl-title">View Configuration</div>
            <div className="owner-ctrl-sub">Read the charger's OCPP settings (heartbeat, meter interval, remote-auth…).</div>
          </div>
          <button className="owner-btn owner-btn-ghost owner-btn-sm" disabled={disabled} onClick={viewConfig}>
            {busy === 'config' ? <Loader2 className="owner-spin" size={15} /> : <ListChecks size={15} />} View
          </button>
        </div>
        <div className="owner-ctrl-row">
          <span className="owner-ctrl-icon tone-violet"><FileText size={17} /></span>
          <div className="owner-ctrl-main">
            <div className="owner-ctrl-title">Get Diagnostics</div>
            <div className="owner-ctrl-sub">Ask the charger to upload its diagnostics log to a URL.</div>
          </div>
          <button className="owner-btn owner-btn-ghost owner-btn-sm" disabled={disabled}
            onClick={() => setFormModal({ kind: 'diagnostics', location: '', retrieveDate: '' })}>
            {busy === 'diagnostics' ? <Loader2 className="owner-spin" size={15} /> : <FileText size={15} />} Request
          </button>
        </div>
        <div className="owner-ctrl-row">
          <span className="owner-ctrl-icon tone-amber"><Download size={17} /></span>
          <div className="owner-ctrl-main">
            <div className="owner-ctrl-title">Update Firmware</div>
            <div className="owner-ctrl-sub">Download &amp; install firmware from a URL (OTA). Use with care.</div>
          </div>
          <button className="owner-btn owner-btn-danger owner-btn-sm" disabled={disabled}
            onClick={() => setFormModal({ kind: 'firmware', location: '', retrieveDate: '' })}>
            {busy === 'firmware' ? <Loader2 className="owner-spin" size={15} /> : <Download size={15} />} Update
          </button>
        </div>
      </div>

      <div className="owner-bottom-space" />

      {/* Confirm dialog */}
      {pending && (
        <div className="owner-modal-overlay" onClick={() => setPending(null)}>
          <div className="owner-confirm" onClick={(e) => e.stopPropagation()}>
            <div className={`owner-confirm-icon ${pending.danger ? 'danger' : ''}`}>
              <AlertTriangle size={30} />
            </div>
            <h3 className="owner-confirm-title">{pending.title}</h3>
            <p className="owner-confirm-text">{pending.message}</p>
            <div className="owner-confirm-actions">
              <button className="owner-btn owner-btn-ghost" onClick={() => setPending(null)}>Cancel</button>
              <button className={`owner-btn ${pending.danger ? 'owner-btn-danger' : 'owner-btn-primary'}`}
                onClick={() => execute(pending.label.toLowerCase().replace(/\s+/g, '-'), pending.label, pending.run)}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configuration display */}
      {configModal && (
        <div className="owner-modal-overlay" onClick={() => setConfigModal(null)}>
          <div className="owner-confirm owner-config-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="owner-confirm-title">Charger Configuration</h3>
            {configModal.loading ? (
              <div className="owner-loading"><Loader2 className="owner-spin" size={22} /> Reading…</div>
            ) : configModal.error ? (
              <p className="owner-confirm-text">{configModal.error}</p>
            ) : (configModal.keys && configModal.keys.length) ? (
              <div className="owner-config-list">
                {configModal.keys.map((k) => (
                  <div key={k.key} className="owner-config-row">
                    <span className="owner-config-key">
                      {k.key}{k.readonly ? <Lock size={11} className="owner-config-lock" /> : null}
                    </span>
                    <span className="owner-config-val">{k.value ?? '—'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="owner-confirm-text">No configuration keys returned.</p>
            )}
            <div className="owner-confirm-actions">
              <button className="owner-btn owner-btn-ghost" onClick={() => setConfigModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostics / Firmware form */}
      {formModal && (
        <div className="owner-modal-overlay" onClick={() => setFormModal(null)}>
          <div className="owner-confirm owner-form-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="owner-confirm-title">{formModal.kind === 'diagnostics' ? 'Get Diagnostics' : 'Update Firmware'}</h3>
            <p className="owner-confirm-text">
              {formModal.kind === 'diagnostics'
                ? 'The charger uploads its diagnostics log to the URL you provide.'
                : 'The charger downloads and installs firmware from this URL, then reboots. Use with care.'}
            </p>
            <label className="owner-form-label">
              {formModal.kind === 'diagnostics' ? 'Upload URL' : 'Firmware URL'}
              <input className="owner-input" type="url" inputMode="url" placeholder="https://…"
                value={formModal.location}
                onChange={(e) => setFormModal({ ...formModal, location: e.target.value })} />
            </label>
            {formModal.kind === 'firmware' && (
              <label className="owner-form-label">
                Retrieve at (optional)
                <input className="owner-input" type="datetime-local"
                  value={formModal.retrieveDate}
                  onChange={(e) => setFormModal({ ...formModal, retrieveDate: e.target.value })} />
              </label>
            )}
            <div className="owner-confirm-actions">
              <button className="owner-btn owner-btn-ghost" onClick={() => setFormModal(null)}>Cancel</button>
              <button className={`owner-btn ${formModal.kind === 'firmware' ? 'owner-btn-danger' : 'owner-btn-primary'}`}
                disabled={!formModal.location.trim()} onClick={submitForm}>
                {formModal.kind === 'diagnostics' ? 'Request' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
