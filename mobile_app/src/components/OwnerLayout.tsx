import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, MapPin, Plus, Receipt, User, LogOut, Zap } from 'lucide-react';
import { authService } from '../services/api';
import '../pages/owner/owner.css';

export default function OwnerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = authService.getCurrentUser();
  const path = location.pathname;

  const logout = () => {
    authService.logout();
    navigate('/login', { replace: true });
  };

  const tabs = [
    { label: 'Dashboard', icon: LayoutGrid, to: '/owner', active: path === '/owner' },
    {
      label: 'Stations', icon: MapPin, to: '/owner/stations',
      active: path.startsWith('/owner/stations') && path !== '/owner/stations/new',
    },
    { label: 'Transactions', icon: Receipt, to: '/owner/transactions', active: path.startsWith('/owner/transactions') },
    { label: 'Profile', icon: User, to: '/owner/profile', active: path.startsWith('/owner/profile') },
  ];

  return (
    <div className="owner-shell">
      <header className="owner-header">
        <div className="owner-brand">
          <div className="owner-brand-badge"><Zap size={18} /></div>
          <div>
            <div className="owner-brand-title">DJT Power Tech</div>
            <div className="owner-brand-sub">Owner Console</div>
          </div>
        </div>
        <div className="owner-header-right">
          <span className="owner-user-name">{user?.name || user?.nm_tx || 'Owner'}</span>
          <button className="owner-icon-btn" onClick={logout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="owner-main">
        <Outlet />
      </main>

      <nav className="owner-bottom-nav">
        {/* Dashboard + Stations */}
        {tabs.slice(0, 2).map((t) => (
          <button key={t.label} className={`owner-nav-item ${t.active ? 'active' : ''}`} onClick={() => navigate(t.to)}>
            <t.icon size={20} />
            <span>{t.label}</span>
          </button>
        ))}

        {/* Elevated center Add */}
        <button className="owner-nav-add-wrap" onClick={() => navigate('/owner/stations/new')} aria-label="Add station">
          <span className={`owner-nav-add ${path === '/owner/stations/new' ? 'active' : ''}`}><Plus size={24} /></span>
          <span className="owner-nav-add-label">Add</span>
        </button>

        {/* Transactions + Profile */}
        {tabs.slice(2).map((t) => (
          <button key={t.label} className={`owner-nav-item ${t.active ? 'active' : ''}`} onClick={() => navigate(t.to)}>
            <t.icon size={20} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
