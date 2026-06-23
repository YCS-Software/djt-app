import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ownerService } from '../../../services/api';
import type { OwnerStation, OwnerMachine, PowerOption, AddMachineResult } from '../../../services/api/ownerService';
import Dropdown from '../../../components/Dropdown';
import {
  ArrowLeft, Cpu, Plug, PlusCircle, MapPin, Zap, Loader2, X, IndianRupee, Star, Power,
  Copy, Check, Wifi, WifiOff, CheckCircle2, Hash, RefreshCw,
} from 'lucide-react';

const CONNECTOR_TYPES = ['CCS2', 'CHAdeMO', 'Type2', 'GB/T', 'Bharat AC', 'Bharat DC'];
const MACHINE_STATUS: Record<string, string> = {
  available: 'Available', in_use: 'In use', offline: 'Offline', faulted: 'Faulted', maintenance: 'Maintenance',
};
// Friendly machine-type labels (codes come from the power-options master)
const MACHINE_TYPE_LABELS: Record<string, string> = {
  AC: 'AC — Alternating Current',
  DC: 'DC — Direct Current',
  DCS: 'DCS — DC Super (high power)',
};

export default function StationDetailPage() {
  const navigate = useNavigate();
  const { stationId } = useParams();
  const sid = Number(stationId);

  const [station, setStation] = useState<OwnerStation | null>(null);
  const [machines, setMachines] = useState<OwnerMachine[]>([]);
  const [powerOptions, setPowerOptions] = useState<PowerOption[]>([]);
  const [powerLoading, setPowerLoading] = useState(false);
  const [powerError, setPowerError] = useState('');
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // modals
  const [machineModal, setMachineModal] = useState(false);
  const [connectorFor, setConnectorFor] = useState<OwnerMachine | null>(null);
  const [addedMachine, setAddedMachine] = useState<AddMachineResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState('');

  const [mForm, setMForm] = useState<{ name: string; machine_type: string; mchn_pwr_id: string; serial_no: string }>({ name: '', machine_type: '', mchn_pwr_id: '', serial_no: '' });
  const [cForm, setCForm] = useState({ connector_type: 'CCS2', power: '', name: '' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const st = await ownerService.getStationDetail(sid);
      setStation(st);
      setMachines(st.machines || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load station');
    } finally {
      setLoading(false);
    }
  };

  const loadPowerOptions = async () => {
    setPowerLoading(true);
    setPowerError('');
    try {
      const opts = await ownerService.getPowerOptions();
      setPowerOptions(opts);
      if (opts.length === 0) setPowerError('No power ratings configured');
    } catch (e: any) {
      setPowerError(e?.message || 'Failed to load power ratings');
    } finally {
      setPowerLoading(false);
    }
  };

  const refreshConnections = async () => {
    try {
      const conns = await ownerService.getOcppConnections();
      setOnlineIds(new Set(conns.map((c) => c.ocpp_id)));
    } catch { /* connectivity is supplementary — ignore failures */ }
  };

  useEffect(() => {
    if (sid) load();
    loadPowerOptions();
    refreshConnections();
    // live online/offline: refresh the connection registry periodically
    const timer = setInterval(refreshConnections, 20000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid]);

  // online (live socket) | offline (configured, not connected) | unconfigured (no OCPP id)
  const connState = (m: OwnerMachine): 'online' | 'offline' | 'unconfigured' => {
    if (!m.ocpp_id) return 'unconfigured';
    return onlineIds.has(m.ocpp_id) ? 'online' : 'offline';
  };
  const CONN_LABEL = { online: 'Online', offline: 'Offline', unconfigured: 'Not configured' } as const;

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 1600);
    } catch { /* clipboard not available */ }
  };

  const openMachineModal = () => {
    setMForm({ name: `Charger ${machines.length + 1}`, machine_type: '', mchn_pwr_id: '', serial_no: '' });
    setError('');
    if (powerOptions.length === 0 && !powerLoading) loadPowerOptions();
    setMachineModal(true);
  };

  const submitMachine = async () => {
    if (!mForm.name.trim()) return setError('Machine name is required');
    if (!mForm.machine_type) return setError('Please select a machine type');
    if (!mForm.mchn_pwr_id) return setError('Please select a power rating');
    setSaving(true);
    setError('');
    try {
      const result = await ownerService.addMachine(sid, {
        name: mForm.name.trim(),
        serial_no: mForm.serial_no.trim() || undefined,
        mchn_pwr_id: Number(mForm.mchn_pwr_id),
        connector_count: 2,
      });
      setMachineModal(false);
      setAddedMachine(result); // show OCPP id + WS URL panel
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to add machine');
    } finally {
      setSaving(false);
    }
  };

  const submitConnector = async () => {
    if (!connectorFor) return;
    setSaving(true);
    setError('');
    try {
      await ownerService.addConnector(connectorFor.machine_id, {
        connector_type: cForm.connector_type,
        power: cForm.power || undefined,
        name: cForm.name || undefined,
      });
      setConnectorFor(null);
      setCForm({ connector_type: 'CCS2', power: '', name: '' });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to add connector');
    } finally {
      setSaving(false);
    }
  };

  // Distinct machine types (preserve master sort order) → dropdown options
  const machineTypeOptions = powerOptions
    .map((p) => p.machine_type)
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .map((t) => ({ value: t, label: MACHINE_TYPE_LABELS[t] || t, badge: t }));

  // Power ratings for the chosen machine type
  const powerOptionsForType = powerOptions
    .filter((p) => p.machine_type === mForm.machine_type)
    .map((p) => ({ value: String(p.power_id), label: p.label, hint: p.default_connector_type }));

  if (loading) {
    return <div className="owner-page"><div className="owner-loading"><Loader2 className="owner-spin" size={26} /> Loading…</div></div>;
  }

  return (
    <div className="owner-page owner-animate-in">
      <div className="owner-page-head">
        <button className="owner-back" onClick={() => navigate('/owner')}><ArrowLeft size={18} /></button>
        <div className="owner-head-grow">
          <h1 className="owner-h1 owner-ellipsis">{station?.name}</h1>
          <p className="owner-sub owner-ellipsis"><MapPin size={12} /> {station?.address}</p>
        </div>
      </div>

      {error && !machineModal && <div className="owner-alert owner-alert-error">{error}</div>}

      {/* Station summary */}
      <div className="owner-card owner-summary">
        <div className="owner-summary-row">
          <span className="owner-code">{station?.code}</span>
          {station?.is_fast_charging && <span className="owner-tag owner-tag-fast"><Zap size={11} /> Fast</span>}
          <span className={`owner-chip owner-status-${station?.approval_status}`}>{station?.approval_status}</span>
        </div>
        <div className="owner-summary-stats">
          <div><IndianRupee size={14} /> {station?.price_per_kwh}<small>/kWh</small></div>
          <div><Cpu size={14} /> {machines.length}<small> machines</small></div>
          <div><Star size={14} /> {(station?.rating ?? 0).toFixed(1)}</div>
        </div>
      </div>

      {/* Infrastructure */}
      <div className="owner-section-head">
        <h2 className="owner-h2">Infrastructure</h2>
        <button className="owner-btn owner-btn-primary owner-btn-sm" onClick={openMachineModal}>
          <PlusCircle size={15} /> Machine
        </button>
      </div>

      {machines.length === 0 ? (
        <div className="owner-empty">
          <div className="owner-empty-icon"><Cpu size={28} /></div>
          <h3>No machines yet</h3>
          <p>Add a charger — we auto-generate its OCPP ID, WebSocket URL and 2 connectors.</p>
          <button className="owner-btn owner-btn-primary" onClick={openMachineModal}>
            <PlusCircle size={18} /> Add Machine
          </button>
        </div>
      ) : (
        <div className="owner-machine-list">
          {machines.map((m) => {
            const cs = connState(m);
            return (
            <div key={m.machine_id} className="owner-machine-card">
              <div className="owner-machine-head">
                <div className="owner-machine-icon"><Power size={18} /></div>
                <div className="owner-machine-info">
                  <div className="owner-machine-name">{m.name}</div>
                  <div className="owner-machine-meta">
                    <span className={`owner-type-badge type-${(m.machine_type || '').toLowerCase()}`}>{m.machine_type}</span>
                    {(m.power_label || m.max_power) && <span className="owner-power-chip"><Zap size={11} /> {m.power_label || m.max_power}</span>}
                    <span className={`owner-conn owner-conn-${cs}`}>
                      {cs === 'online' ? <Wifi size={11} /> : <WifiOff size={11} />}
                      <span className="owner-conn-dot" /> {CONN_LABEL[cs]}
                    </span>
                  </div>
                </div>
                <span className={`owner-mstatus owner-status-${m.status}`}>{MACHINE_STATUS[m.status] || m.status}</span>
              </div>

              {/* OCPP connectivity */}
              <div className="owner-ocpp-box">
                <div className="owner-ocpp-row">
                  <span className="owner-ocpp-label"><Hash size={12} /> OCPP ID</span>
                  {m.ocpp_id ? (
                    <>
                      <span className="owner-ocpp-val">{m.ocpp_id}</span>
                      <button className="owner-copy-btn" onClick={() => copy(m.ocpp_id!, `id-${m.machine_id}`)}>
                        {copied === `id-${m.machine_id}` ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    </>
                  ) : (
                    <span className="owner-ocpp-val owner-ocpp-unset">Not configured</span>
                  )}
                </div>
                <div className="owner-ocpp-row">
                  <span className="owner-ocpp-label"><Wifi size={12} /> WebSocket</span>
                  {m.ws_url ? (
                    <>
                      <span className="owner-ocpp-val owner-ocpp-url">{m.ws_url}</span>
                      <button className="owner-copy-btn" onClick={() => copy(m.ws_url!, `ws-${m.machine_id}`)}>
                        {copied === `ws-${m.machine_id}` ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    </>
                  ) : (
                    <span className="owner-ocpp-val owner-ocpp-unset">Not configured</span>
                  )}
                </div>
              </div>

              <div className="owner-connectors">
                {(m.connectors || []).map((c) => (
                  <span key={c.connector_id} className="owner-connector-pill">
                    <Plug size={11} /> {c.type}{c.power ? ` · ${c.power}` : ''}
                  </span>
                ))}
                <button className="owner-add-connector" onClick={() => setConnectorFor(m)}>
                  <PlusCircle size={13} /> Connector
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
      <div className="owner-bottom-space" />

      {/* Add machine modal */}
      {machineModal && (
        <div className="owner-modal-overlay" onClick={() => !saving && setMachineModal(false)}>
          <div className="owner-modal" onClick={(e) => e.stopPropagation()}>
            <div className="owner-modal-head">
              <h3><Cpu size={17} /> Add machine</h3>
              <button className="owner-icon-btn" onClick={() => setMachineModal(false)}><X size={18} /></button>
            </div>

            {error && <div className="owner-alert owner-alert-error">{error}</div>}

            <div className="owner-field">
              <label>Machine name *</label>
              <input className="owner-input" value={mForm.name} onChange={(e) => setMForm({ ...mForm, name: e.target.value })} placeholder="e.g. Charger 1" />
            </div>

            <div className="owner-field">
              <label><Cpu size={12} /> Machine type *</label>
              <Dropdown
                ariaLabel="Machine type"
                value={mForm.machine_type}
                options={machineTypeOptions}
                placeholder={powerLoading ? 'Loading…' : 'Select machine type…'}
                disabled={powerLoading || machineTypeOptions.length === 0}
                emptyText="No machine types"
                onChange={(v) => setMForm({ ...mForm, machine_type: v, mchn_pwr_id: '' })}
              />
            </div>

            <div className="owner-field">
              <label><Zap size={12} /> Power rating *</label>
              <Dropdown
                ariaLabel="Power rating"
                value={mForm.mchn_pwr_id}
                options={powerOptionsForType}
                placeholder={!mForm.machine_type ? 'Select a machine type first' : 'Select power rating…'}
                disabled={powerLoading || !mForm.machine_type}
                emptyText="No power ratings for this type"
                onChange={(v) => setMForm({ ...mForm, mchn_pwr_id: v })}
              />
              {powerError && (
                <div className="owner-field-error">
                  <span>{powerError}</span>
                  <button type="button" className="owner-link-btn" onClick={loadPowerOptions} disabled={powerLoading}>
                    <RefreshCw size={12} className={powerLoading ? 'owner-spin' : ''} /> Retry
                  </button>
                </div>
              )}
            </div>

            <div className="owner-field">
              <label>Serial no. <span className="owner-optional">(optional)</span></label>
              <input className="owner-input" value={mForm.serial_no} onChange={(e) => setMForm({ ...mForm, serial_no: e.target.value })} placeholder="Manufacturer serial" />
            </div>

            <div className="owner-note">
              <CheckCircle2 size={14} /> OCPP ID, WebSocket URL &amp; <strong>2 connectors</strong> are generated automatically.
            </div>

            <button className="owner-btn owner-btn-primary owner-btn-block" onClick={submitMachine} disabled={saving}>
              {saving ? <><Loader2 className="owner-spin" size={16} /> Creating…</> : 'Add machine'}
            </button>
          </div>
        </div>
      )}

      {/* Machine-added success panel (OCPP id + WS URL) */}
      {addedMachine && (
        <div className="owner-modal-overlay" onClick={() => setAddedMachine(null)}>
          <div className="owner-modal" onClick={(e) => e.stopPropagation()}>
            <div className="owner-success-head">
              <div className="owner-success-icon"><CheckCircle2 size={30} /></div>
              <h3>Machine added</h3>
              <p>{addedMachine.power_label} · {addedMachine.connectors_created} connectors ({addedMachine.connector_type})</p>
            </div>

            <label className="owner-success-label"><Hash size={13} /> OCPP Charge Point ID</label>
            <div className="owner-copy-field">
              <span className="owner-copy-text">{addedMachine.ocpp_id}</span>
              <button className="owner-copy-btn lg" onClick={() => copy(addedMachine.ocpp_id, 'a-id')}>
                {copied === 'a-id' ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
              </button>
            </div>

            <label className="owner-success-label"><Wifi size={13} /> WebSocket URL (configure on the charger)</label>
            <div className="owner-copy-field">
              <span className="owner-copy-text owner-ocpp-url">{addedMachine.ws_url}</span>
              <button className="owner-copy-btn lg" onClick={() => copy(addedMachine.ws_url, 'a-ws')}>
                {copied === 'a-ws' ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
              </button>
            </div>

            <button className="owner-btn owner-btn-primary owner-btn-block" onClick={() => setAddedMachine(null)}>Done</button>
          </div>
        </div>
      )}

      {/* Add connector modal */}
      {connectorFor && (
        <div className="owner-modal-overlay" onClick={() => !saving && setConnectorFor(null)}>
          <div className="owner-modal" onClick={(e) => e.stopPropagation()}>
            <div className="owner-modal-head">
              <h3><Plug size={17} /> Add connector</h3>
              <button className="owner-icon-btn" onClick={() => setConnectorFor(null)}><X size={18} /></button>
            </div>
            <p className="owner-modal-sub">To machine: <strong>{connectorFor.name}</strong></p>
            <div className="owner-field">
              <label>Connector type *</label>
              <Dropdown
                ariaLabel="Connector type"
                value={cForm.connector_type}
                options={CONNECTOR_TYPES.map((t) => ({ value: t, label: t }))}
                onChange={(v) => setCForm({ ...cForm, connector_type: v })}
              />
            </div>
            <div className="owner-grid-2">
              <div className="owner-field">
                <label>Power</label>
                <input className="owner-input" value={cForm.power} onChange={(e) => setCForm({ ...cForm, power: e.target.value })} placeholder="e.g. 60kW" />
              </div>
              <div className="owner-field">
                <label>Label</label>
                <input className="owner-input" value={cForm.name} onChange={(e) => setCForm({ ...cForm, name: e.target.value })} placeholder="Optional" />
              </div>
            </div>
            <button className="owner-btn owner-btn-primary owner-btn-block" onClick={submitConnector} disabled={saving}>
              {saving ? <><Loader2 className="owner-spin" size={16} /> Saving…</> : 'Add connector'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
