import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, LogOut, Zap } from 'lucide-react';
import { authService } from '../services/api';
import '../pages/owner/owner.css';

export default function OwnerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = authService.getCurrentUser();

  const isActive = (path: string) =>
    path === '/owner' ? location.pathname === '/owner' : location.pathname.startsWith(path);

  const logout = () => {
    authService.logout();
    navigate('/login', { replace: true });
  };

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
        <button className={`owner-nav-item ${isActive('/owner') ? 'active' : ''}`} onClick={() => navigate('/owner')}>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </button>
        <button
          className={`owner-nav-item ${isActive('/owner/stations/new') ? 'active' : ''}`}
          onClick={() => navigate('/owner/stations/new')}
        >
          <PlusCircle size={20} />
          <span>Add Station</span>
        </button>
        <button className="owner-nav-item" onClick={logout}>
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </nav>
    </div>
  );
}
