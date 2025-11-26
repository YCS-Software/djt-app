import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Wallet, Zap, User, LogOut } from 'lucide-react';
import './Navigation.css';

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('x-access-token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const navItems = [
    { path: '/home', icon: Home, label: 'Home' },
    { path: '/wallet', icon: Wallet, label: 'Wallet' },
    { path: '/charging', icon: Zap, label: 'Charging' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="bottom-navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={24} />
            <span>{item.label}</span>
          </Link>
        );
      })}
      
      {/* <button onClick={handleLogout} className="nav-item logout-btn">
        <LogOut size={24} />
        <span>Logout</span>
      </button> */}
    </nav>
  );
};

export default Navigation;
