import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ownerService, authService } from '../../../services/api';
import type { OwnerDashboard } from '../../../services/api/ownerService';
import {
  Phone, Mail, ShieldCheck, LogOut, Building2, Cpu, Plug, Zap, ChevronRight,
} from 'lucide-react';

export default function OwnerProfilePage() {
  const navigate = useNavigate();
  const user = authService.getCurrentUser() || {};
  const name: string = user.name || user.nm_tx || 'Owner';
  const email: string | null = user.email || user.eml_tx || null;
  const phone: string | null = user.phone || user.phn_nmbr_tx || null;
  const initial = name.trim().charAt(0).toUpperCase() || 'O';

  const [stats, setStats] = useState<OwnerDashboard | null>(null);

  useEffect(() => {
    ownerService.getDashboard().then(setStats).catch(() => {});
  }, []);

  const logout = () => {
    authService.logout();
    navigate('/login', { replace: true });
  };

  const statItems = [
    { label: 'Stations', value: stats?.total_stations ?? 0, icon: Building2, tone: 'cyan' },
    { label: 'Machines', value: stats?.total_machines ?? 0, icon: Cpu, tone: 'teal' },
    { label: 'Connectors', value: stats?.total_connectors ?? 0, icon: Plug, tone: 'violet' },
    { label: 'Available', value: stats?.available_machines ?? 0, icon: Zap, tone: 'green' },
  ];

  return (
    <div className="owner-page owner-animate-in">
      <div className="owner-page-head">
        <div className="owner-head-grow">
          <h1 className="owner-h1">Profile</h1>
          <p className="owner-sub">Account & overview</p>
        </div>
      </div>

      {/* Identity */}
      <div className="owner-card owner-profile-card">
        <div className="owner-avatar">{initial}</div>
        <div className="owner-profile-id">
          <div className="owner-profile-name">{name}</div>
          <span className="owner-tag owner-tag-fast"><ShieldCheck size={12} /> Station Owner</span>
        </div>
      </div>

      {/* Network overview */}
      <div className="owner-stats-grid">
        {statItems.map((s) => (
          <div key={s.label} className={`owner-stat-card tone-${s.tone}`}>
            <div className="owner-stat-icon"><s.icon size={18} /></div>
            <div className="owner-stat-value">{s.value}</div>
            <div className="owner-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Contact */}
      <div className="owner-section-head"><h2 className="owner-h2">Contact</h2></div>
      <div className="owner-card owner-info-list">
        <div className="owner-info-row">
          <span className="owner-info-icon"><Phone size={15} /></span>
          <div className="owner-info-main">
            <div className="owner-info-label">Phone</div>
            <div className="owner-info-value">{phone || '—'}</div>
          </div>
        </div>
        <div className="owner-info-row">
          <span className="owner-info-icon"><Mail size={15} /></span>
          <div className="owner-info-main">
            <div className="owner-info-label">Email</div>
            <div className="owner-info-value">{email || '—'}</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="owner-section-head"><h2 className="owner-h2">Account</h2></div>
      <div className="owner-card owner-info-list">
        <button className="owner-info-row owner-info-action" onClick={() => navigate('/owner/stations/new')}>
          <span className="owner-info-icon"><Building2 size={15} /></span>
          <div className="owner-info-main">
            <div className="owner-info-value">Add a new station</div>
          </div>
          <ChevronRight size={18} className="owner-info-arrow" />
        </button>
      </div>

      <button className="owner-btn owner-btn-danger owner-btn-block" onClick={logout}>
        <LogOut size={16} /> Log out
      </button>

      <div className="owner-bottom-space" />
    </div>
  );
}
