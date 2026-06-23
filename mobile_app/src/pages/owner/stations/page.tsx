import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ownerService } from '../../../services/api';
import type { OwnerStation } from '../../../services/api/ownerService';
import {
  Building2, Cpu, Plug, Zap, PlusCircle, MapPin, Loader2, Star, IndianRupee, Settings, User,
} from 'lucide-react';

export default function OwnerStationsPage() {
  const navigate = useNavigate();
  const [stations, setStations] = useState<OwnerStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        setStations(await ownerService.getMyStations());
      } catch (e: any) {
        setError(e?.message || 'Failed to load stations');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="owner-page owner-animate-in">
      <div className="owner-page-head">
        <div className="owner-head-grow">
          <h1 className="owner-h1">Stations</h1>
          <p className="owner-sub">Manage your charging network</p>
        </div>
        <button className="owner-btn owner-btn-primary owner-btn-sm" onClick={() => navigate('/owner/stations/new')}>
          <PlusCircle size={16} /> Add Station
        </button>
      </div>

      {error && <div className="owner-alert owner-alert-error">{error}</div>}

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
            <div key={st.station_id} className="owner-station-card owner-station-card-static">
              <div className="owner-station-main">
                <div className="owner-station-title-row">
                  <span className="owner-station-name">{st.name}</span>
                  {st.is_fast_charging && <span className="owner-tag owner-tag-fast"><Zap size={11} /> Fast</span>}
                </div>
                <div className="owner-station-meta">
                  <span><MapPin size={12} /> {st.city || st.address}</span>
                  <span className="owner-dot">•</span>
                  <span><IndianRupee size={11} />{st.price_per_kwh}/kWh</span>
                  {st.rating > 0 && (<><span className="owner-dot">•</span><span><Star size={12} /> {st.rating.toFixed(1)}</span></>)}
                </div>
                <div className="owner-station-chips">
                  <span className="owner-chip"><Cpu size={12} /> {st.machine_count ?? 0} machines</span>
                  <span className="owner-chip"><Plug size={12} /> {st.connector_count ?? 0} connectors</span>
                  <span className={`owner-chip owner-status-${st.approval_status}`}>{st.approval_status}</span>
                </div>
              </div>
              <div className="owner-station-actions">
                <button className="owner-btn owner-btn-ghost owner-btn-sm" onClick={() => navigate(`/owner/stations/${st.station_id}`)}>
                  <User size={15} /> Profile
                </button>
                <button className="owner-btn owner-btn-primary owner-btn-sm" onClick={() => navigate(`/owner/stations/${st.station_id}/manage`)}>
                  <Settings size={15} /> Manage
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="owner-bottom-space" />
    </div>
  );
}
