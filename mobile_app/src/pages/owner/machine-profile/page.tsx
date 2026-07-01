import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ownerService } from '../../../services/api';
import type { MachineProfile } from '../../../services/api/ownerService';
import ConnectorQrModal from '../../../components/ConnectorQrModal';
import {
  ArrowLeft, Power, Plug, Zap, Loader2, IndianRupee, Receipt, Clock, BarChart3, Tag, Activity,
  Hash, Wifi, WifiOff, Copy, Check, Cpu, Building2, CalendarDays, TrendingUp, TrendingDown, Settings, QrCode,
} from 'lucide-react';

const MACHINE_STATUS: Record<string, string> = {
  available: 'Available', in_use: 'In use', offline: 'Offline', faulted: 'Faulted', maintenance: 'Maintenance',
};

const inr = (n: number, dp = 2) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });

function fmtDate(d?: string | null, withTime = false) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  const base = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  return withTime ? `${base}, ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : base;
}

function Trend({ pct }: { pct: number }) {
  const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  const Icon = pct >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`owner-trend owner-trend-${dir}`}>
      <Icon size={11} /> {Math.abs(pct)}% <span className="owner-trend-sub">vs yesterday</span>
    </span>
  );
}

export default function MachineProfilePage() {
  const navigate = useNavigate();
  const { machineId } = useParams();
  const mid = Number(machineId);

  const [data, setData] = useState<MachineProfile | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [qrConnectorId, setQrConnectorId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const profile = await ownerService.getMachineProfile(mid);
        setData(profile);
        if (profile.machine.ocpp_id) {
          ownerService.getOcppConnections()
            .then((conns) => setOnline(conns.some((c) => c.ocpp_id === profile.machine.ocpp_id)))
            .catch(() => {});
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load machine');
      } finally {
        setLoading(false);
      }
    })();
  }, [mid]);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 1600);
    } catch { /* clipboard not available */ }
  };

  if (loading) {
    return <div className="owner-page"><div className="owner-loading"><Loader2 className="owner-spin" size={26} /> Loading…</div></div>;
  }
  if (error || !data) {
    return (
      <div className="owner-page owner-animate-in">
        <div className="owner-page-head">
          <button className="owner-back" onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
          <div className="owner-head-grow"><h1 className="owner-h1">Machine</h1></div>
        </div>
        <div className="owner-alert owner-alert-error">{error || 'Machine not found'}</div>
      </div>
    );
  }

  const { machine: m, connectors, analytics: a } = data;
  const cs = !m.ocpp_id ? 'unconfigured' : online ? 'online' : 'offline';
  const csLabel = cs === 'online' ? 'Online' : cs === 'offline' ? 'Offline' : 'Not configured';

  return (
    <div className="owner-page owner-animate-in">
      <div className="owner-page-head">
        <button className="owner-back" onClick={() => navigate(`/owner/stations/${m.station_id}/manage`)}><ArrowLeft size={18} /></button>
        <div className="owner-head-grow">
          <h1 className="owner-h1 owner-ellipsis">{m.name}</h1>
          <p className="owner-sub owner-ellipsis"><Building2 size={12} /> {m.station_name}</p>
        </div>
        <button className="owner-btn owner-btn-ghost owner-btn-sm" onClick={() => navigate(`/owner/stations/${m.station_id}/manage`)}>
          <Settings size={15} /> Manage
        </button>
      </div>

      {/* Summary chips */}
      <div className="owner-card owner-summary">
        <div className="owner-summary-row">
          <span className={`owner-type-badge type-${(m.machine_type || '').toLowerCase()}`}>{m.machine_type}</span>
          {(m.power_label || m.max_power) && <span className="owner-power-chip"><Zap size={11} /> {m.power_label || m.max_power}</span>}
          <span className={`owner-conn owner-conn-${cs}`}>
            {cs === 'online' ? <Wifi size={11} /> : <WifiOff size={11} />}
            <span className="owner-conn-dot" /> {csLabel}
          </span>
          <span className={`owner-mstatus owner-status-${m.status}`}>{MACHINE_STATUS[m.status] || m.status}</span>
        </div>
        <p className="owner-field-hint owner-qr-cta">Each connector below has its own QR — tap the QR icon to download it.</p>
      </div>

      {/* Performance — Today */}
      <div className="owner-section-head"><h2 className="owner-h2">Today</h2></div>
      <div className="owner-stats-grid owner-stats-3">
        <div className="owner-stat-card tone-green">
          <div className="owner-stat-icon"><IndianRupee size={18} /></div>
          <div className="owner-stat-value">₹{inr(a.today.revenue)}</div>
          <div className="owner-stat-label">Revenue</div>
          <Trend pct={a.today.revenue_trend_pct} />
        </div>
        <div className="owner-stat-card tone-cyan">
          <div className="owner-stat-icon"><Zap size={18} /></div>
          <div className="owner-stat-value">{inr(a.today.consumption)}<small> kWh</small></div>
          <div className="owner-stat-label">Consumption</div>
          <Trend pct={a.today.consumption_trend_pct} />
        </div>
        <div className="owner-stat-card tone-violet">
          <div className="owner-stat-icon"><Receipt size={18} /></div>
          <div className="owner-stat-value">{a.today.sessions}</div>
          <div className="owner-stat-label">Sessions</div>
        </div>
      </div>

      {/* This Month */}
      <div className="owner-section-head"><h2 className="owner-h2">This Month</h2></div>
      <div className="owner-card owner-summary-tiles">
        <div className="owner-tile">
          <span className="owner-tile-icon tone-green"><IndianRupee size={15} /></span>
          <div className="owner-tile-label">Revenue</div>
          <div className="owner-tile-value">₹{inr(a.month.revenue)}</div>
          <div className="owner-tile-sub">{a.month.sessions} sessions</div>
        </div>
        <div className="owner-tile">
          <span className="owner-tile-icon tone-cyan"><BarChart3 size={15} /></span>
          <div className="owner-tile-label">Consumption</div>
          <div className="owner-tile-value">{inr(a.month.consumption)} <small>kWh</small></div>
          <div className="owner-tile-sub">This month</div>
        </div>
        <div className="owner-tile">
          <span className="owner-tile-icon tone-amber"><Tag size={15} /></span>
          <div className="owner-tile-label">Avg. ₹ / kWh</div>
          <div className="owner-tile-value">₹{inr(a.month.avg_revenue_per_kwh)}</div>
          <div className="owner-tile-sub">This month</div>
        </div>
        <div className="owner-tile">
          <span className="owner-tile-icon tone-violet"><Plug size={15} /></span>
          <div className="owner-tile-label">Connectors</div>
          <div className="owner-tile-value">{connectors.length}</div>
          <div className="owner-tile-sub">On this machine</div>
        </div>
      </div>

      {/* All Time */}
      <div className="owner-section-head"><h2 className="owner-h2">All Time</h2></div>
      <div className="owner-card owner-summary-tiles">
        <div className="owner-tile">
          <span className="owner-tile-icon tone-green"><IndianRupee size={15} /></span>
          <div className="owner-tile-label">Total Revenue</div>
          <div className="owner-tile-value">₹{inr(a.lifetime.revenue)}</div>
          <div className="owner-tile-sub">All time</div>
        </div>
        <div className="owner-tile">
          <span className="owner-tile-icon tone-cyan"><BarChart3 size={15} /></span>
          <div className="owner-tile-label">Total Energy</div>
          <div className="owner-tile-value">{inr(a.lifetime.consumption)} <small>kWh</small></div>
          <div className="owner-tile-sub">All time</div>
        </div>
        <div className="owner-tile">
          <span className="owner-tile-icon tone-violet"><Activity size={15} /></span>
          <div className="owner-tile-label">Sessions</div>
          <div className="owner-tile-value">{a.lifetime.sessions}</div>
          <div className="owner-tile-sub">Completed</div>
        </div>
        <div className="owner-tile">
          <span className="owner-tile-icon tone-amber"><Clock size={15} /></span>
          <div className="owner-tile-label">Avg. Duration</div>
          <div className="owner-tile-value">{a.lifetime.avg_duration_min} <small>min</small></div>
          <div className="owner-tile-sub">Per session</div>
        </div>
      </div>

      {/* Machine details */}
      <div className="owner-section-head"><h2 className="owner-h2">Machine Details</h2></div>
      <div className="owner-card owner-info-list">
        <div className="owner-info-row">
          <span className="owner-info-icon"><Hash size={15} /></span>
          <div className="owner-info-main">
            <div className="owner-info-label">OCPP Charge Point ID</div>
            <div className="owner-info-value">{m.ocpp_id || <span className="owner-ocpp-unset">Not configured</span>}</div>
          </div>
          {m.ocpp_id && (
            <button className="owner-copy-btn" onClick={() => copy(m.ocpp_id!, 'id')}>
              {copied === 'id' ? <Check size={13} /> : <Copy size={13} />}
            </button>
          )}
        </div>
        <div className="owner-info-row">
          <span className="owner-info-icon"><Wifi size={15} /></span>
          <div className="owner-info-main">
            <div className="owner-info-label">WebSocket URL</div>
            <div className="owner-info-value owner-info-wrap owner-ocpp-url">{m.ws_url || <span className="owner-ocpp-unset">Not configured</span>}</div>
          </div>
          {m.ws_url && (
            <button className="owner-copy-btn" onClick={() => copy(m.ws_url!, 'ws')}>
              {copied === 'ws' ? <Check size={13} /> : <Copy size={13} />}
            </button>
          )}
        </div>
        <div className="owner-info-row">
          <span className="owner-info-icon"><Cpu size={15} /></span>
          <div className="owner-info-main">
            <div className="owner-info-label">Type / Power</div>
            <div className="owner-info-value">{m.machine_type}{(m.power_label || m.max_power) ? ` · ${m.power_label || m.max_power}` : ''}</div>
          </div>
        </div>
        <div className="owner-info-row">
          <span className="owner-info-icon"><Hash size={15} /></span>
          <div className="owner-info-main">
            <div className="owner-info-label">Serial number</div>
            <div className="owner-info-value">{m.serial_no || '—'}</div>
          </div>
        </div>
        <div className="owner-info-row">
          <span className="owner-info-icon"><Power size={15} /></span>
          <div className="owner-info-main">
            <div className="owner-info-label">Status</div>
            <div className="owner-info-value">{MACHINE_STATUS[m.status] || m.status}</div>
          </div>
        </div>
        <div className="owner-info-row">
          <span className="owner-info-icon"><Wifi size={15} /></span>
          <div className="owner-info-main">
            <div className="owner-info-label">Last heartbeat</div>
            <div className="owner-info-value">{fmtDate(m.last_heartbeat, true)}</div>
          </div>
        </div>
        <div className="owner-info-row">
          <span className="owner-info-icon"><CalendarDays size={15} /></span>
          <div className="owner-info-main">
            <div className="owner-info-label">Added</div>
            <div className="owner-info-value">{fmtDate(m.created_at)}</div>
          </div>
        </div>
      </div>

      {/* Connectors */}
      <div className="owner-section-head">
        <h2 className="owner-h2">Connectors</h2>
        <span className="owner-count-pill">{connectors.length}</span>
      </div>
      {connectors.length === 0 ? (
        <div className="owner-card owner-txn-empty"><Plug size={18} /> No connectors</div>
      ) : (
        <div className="owner-card owner-info-list">
          {connectors.map((c) => (
            <div key={c.connector_id} className="owner-info-row">
              <span className="owner-info-icon"><Plug size={15} /></span>
              <div className="owner-info-main">
                <div className="owner-info-value">{c.code || c.name || c.type}</div>
                <div className="owner-info-label">{c.type}{c.power ? ` · ${c.power}` : ''}</div>
              </div>
              <span className={`owner-chip ${c.is_available ? 'owner-status-available' : 'owner-status-in_use'}`}>
                {c.is_available ? 'Available' : 'In use'}
              </span>
              <button className="owner-conn-qr-btn lg" title="Connector QR" onClick={() => setQrConnectorId(c.connector_id)}>
                <QrCode size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="owner-bottom-space" />

      {qrConnectorId != null && <ConnectorQrModal connectorId={qrConnectorId} onClose={() => setQrConnectorId(null)} />}
    </div>
  );
}
