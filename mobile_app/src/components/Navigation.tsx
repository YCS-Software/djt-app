import { Link, useLocation } from 'react-router-dom';
import { Home, Wallet, Zap } from 'lucide-react';
import './Navigation.css';

const Navigation = () => {
  const location = useLocation();

  const navItems = [
    { path: '/home', icon: Home, label: 'Home' },
    { path: '/charging', icon: Zap, label: 'Charging' },
    { path: '/wallet', icon: Wallet, label: 'Wallet' },
  ];

  // Don't show navigation on login/signup pages
  if (location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/') {
    return null;
  }

  return (
    <nav className="bottom-nav">
      <div className="nav-container">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          const isCharging = item.path === '/charging';
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive ? 'active' : ''} ${isCharging ? 'charging-tab' : ''}`}
            >
              {isCharging ? (
                <div className="charging-icon-wrap">
                  <Icon size={24} />
                </div>
              ) : (
                <Icon size={24} />
              )}
              <span className="nav-label">{item.label}</span>
              {isActive && <div className="active-indicator" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default Navigation;
