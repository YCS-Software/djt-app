import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ownerService } from '../../../services/api';
import type { OwnerStation, OwnerMachine, CreateMachineRequest } from '../../../services/api/ownerService';
import {
  ArrowLeft, Cpu, Plug, PlusCircle, MapPin, Zap, Loader2, X, IndianRupee, Star, Power,
} from 'lucide-react';

const CONNECTOR_TYPES = ['CCS2', 'CHAdeMO', 'Type2', 'GB/T', 'Bharat AC', 'Bharat DC'];
const MACHINE_STATUS: Record<string, string> = {
  available: 'Available', in_use: 'In use', offline: 'Offline', faulted: 'Faulted', maintenance: 'Maintenance',
};

export default function StationDetailPage() {
  const navigate = useNavigate();
  const { stationId } = useParams();
  const sid = Number(stationId);

  const [station, setStation] = useState<OwnerStation | null>(null);
  const [machines, setMachines] = useState<OwnerMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // modals
  const [machineModal, setMachineModal] = useState(false);
  const [connectorFor, setConnectorFor] = useState<OwnerMachine | null>(null);
  const [saving, setSaving] = useState(false);

  const [mForm, setMForm] = useState<CreateMachineRequest>({ name: '', machine_type: 'DC', max_power: '', serial_no: '', ocpp_id: '' });
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

  useEffect(() => {
    if (sid) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid]);

  const submitMachine = async () => {
    if (!mForm.name?.trim()) return setError('Machine name is required');
    setSaving(true);
    setError('');
    try {
      await ownerService.addMachine(sid, mForm);
      setMachineModal(false);
      setMForm({ name: '', machine_type: 'DC', max_power: '', serial_no: '', ocpp_id: '' });
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

      {error && <div className="owner-alert owner-alert-error">{error}</div>}

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
        <button className="owner-btn owner-btn-primary owner-btn-sm" onClick={() => setMachineModal(true)}>
          <PlusCircle size={15} /> Machine
        </button>
      </div>

      {machines.length === 0 ? (
        <div className="owner-empty">
          <div className="owner-empty-icon"><Cpu size={28} /></div>
          <h3>No machines yet</h3>
          <p>Add charging machines, then add connector ports to each.</p>
          <button className="owner-btn owner-btn-primary" onClick={() => setMachineModal(true)}>
            <PlusCircle size={18} /> Add Machine
          </button>
        </div>
      ) : (
        <div className="owner-machine-list">
          {machines.map((m) => (
            <div key={m.machine_id} className="owner-machine-card">
              <div className="owner-machine-head">
                <div className="owner-machine-icon"><Power size={18} /></div>
                <div className="owner-machine-info">
                  <div className="owner-machine-name">{m.name}</div>
                  <div className="owner-machine-meta">
                    <span>{m.machine_type}</span>
                    {m.max_power && (<><span className="owner-dot">•</span><span>{m.max_power}</span></>)}
                    {m.ocpp_id && (<><span className="owner-dot">•</span><span>OCPP: {m.ocpp_id}</span></>)}
                  </div>
                </div>
                <span className={`owner-mstatus owner-status-${m.status}`}>{MACHINE_STATUS[m.status] || m.status}</span>
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
          ))}
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
            <div className="owner-field">
              <label>Machine name *</label>
              <input className="owner-input" value={mForm.name} onChange={(e) => setMForm({ ...mForm, name: e.target.value })} placeholder="e.g. Charger 1" />
            </div>
            <div className="owner-grid-2">
              <div className="owner-field">
                <label>Type</label>
                <select className="owner-input" value={mForm.machine_type} onChange={(e) => setMForm({ ...mForm, machine_type: e.target.value })}>
                  <option value="DC">DC (Fast)</option>
                  <option value="AC">AC</option>
                </select>
              </div>
              <div className="owner-field">
                <label>Max power</label>
                <input className="owner-input" value={mForm.max_power} onChange={(e) => setMForm({ ...mForm, max_power: e.target.value })} placeholder="e.g. 60kW" />
              </div>
            </div>
            <div className="owner-grid-2">
              <div className="owner-field">
                <label>Serial no.</label>
                <input className="owner-input" value={mForm.serial_no} onChange={(e) => setMForm({ ...mForm, serial_no: e.target.value })} placeholder="Optional" />
              </div>
              <div className="owner-field">
                <label>OCPP ID</label>
                <input className="owner-input" value={mForm.ocpp_id} onChange={(e) => setMForm({ ...mForm, ocpp_id: e.target.value })} placeholder="ChargePoint ID" />
              </div>
            </div>
            <button className="owner-btn owner-btn-primary owner-btn-block" onClick={submitMachine} disabled={saving}>
              {saving ? <><Loader2 className="owner-spin" size={16} /> Saving…</> : 'Add machine'}
            </button>
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
              <select className="owner-input" value={cForm.connector_type} onChange={(e) => setCForm({ ...cForm, connector_type: e.target.value })}>
                {CONNECTOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
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
