import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ownerService } from '../../../services/api';
import type { OwnerDashboard, OwnerStation } from '../../../services/api/ownerService';
import {
  Building2, Cpu, Plug, Zap, PlusCircle, ChevronRight, MapPin, Loader2, Star,
} from 'lucide-react';

export default function OwnerDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<OwnerDashboard | null>(null);
  const [stations, setStations] = useState<OwnerStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [s, list] = await Promise.all([
        ownerService.getDashboard().catch(() => null),
        ownerService.getMyStations().catch(() => []),
      ]);
      if (s) setStats(s);
      setStations(list);
    } catch (e: any) {
      setError(e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const statCards = [
    { label: 'Stations', value: stats?.total_stations ?? 0, icon: Building2, tone: 'cyan' },
    { label: 'Machines', value: stats?.total_machines ?? 0, icon: Cpu, tone: 'teal' },
    { label: 'Connectors', value: stats?.total_connectors ?? 0, icon: Plug, tone: 'violet' },
    { label: 'Available', value: stats?.available_machines ?? 0, icon: Zap, tone: 'green' },
  ];

  return (
    <div className="owner-page owner-animate-in">
      <div className="owner-page-head">
        <div>
          <h1 className="owner-h1">Welcome back</h1>
          <p className="owner-sub">Manage your charging network</p>
        </div>
        <button className="owner-btn owner-btn-primary owner-btn-sm" onClick={() => navigate('/owner/stations/new')}>
          <PlusCircle size={16} /> New
        </button>
      </div>

      {/* Stats */}
      <div className="owner-stats-grid">
        {statCards.map((c) => (
          <div key={c.label} className={`owner-stat-card tone-${c.tone}`}>
            <div className="owner-stat-icon"><c.icon size={18} /></div>
            <div className="owner-stat-value">{loading ? '—' : c.value}</div>
            <div className="owner-stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      {error && <div className="owner-alert owner-alert-error">{error}</div>}

      {/* Stations list */}
      <div className="owner-section-head">
        <h2 className="owner-h2">Your Stations</h2>
        {stations.length > 0 && <span className="owner-count-pill">{stations.length}</span>}
      </div>

      {loading ? (
        <div className="owner-loading"><Loader2 className="owner-spin" size={26} /> Loading…</div>
      ) : stations.length === 0 ? (
        <div className="owner-empty">
          <div className="owner-empty-icon"><Building2 size={30} /></div>
          <h3>No stations yet</h3>
          <p>Create your first charging station and start adding machines.</p>
          <button className="owner-btn owner-btn-primary" onClick={() => navigate('/owner/stations/new')}>
            <PlusCircle size={18} /> Create Station
          </button>
        </div>
      ) : (
        <div className="owner-station-list">
          {stations.map((st) => (
            <button key={st.station_id} className="owner-station-card" onClick={() => navigate(`/owner/stations/${st.station_id}`)}>
              <div className="owner-station-main">
                <div className="owner-station-title-row">
                  <span className="owner-station-name">{st.name}</span>
                  {st.is_fast_charging && <span className="owner-tag owner-tag-fast"><Zap size={11} /> Fast</span>}
                </div>
                <div className="owner-station-meta">
                  <span><MapPin size={12} /> {st.city || st.address}</span>
                  <span className="owner-dot">•</span>
                  <span>₹{st.price_per_kwh}/kWh</span>
                  {st.rating > 0 && (<><span className="owner-dot">•</span><span><Star size={12} /> {st.rating.toFixed(1)}</span></>)}
                </div>
                <div className="owner-station-chips">
                  <span className="owner-chip"><Cpu size={12} /> {st.machine_count ?? 0} machines</span>
                  <span className="owner-chip"><Plug size={12} /> {st.connector_count ?? 0} connectors</span>
                  <span className={`owner-chip owner-status-${st.approval_status}`}>{st.approval_status}</span>
                </div>
              </div>
              <ChevronRight size={20} className="owner-station-arrow" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
