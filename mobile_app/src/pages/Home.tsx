import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Wallet, 
  QrCode, 
  MapPin, 
  History, 
  HelpCircle, 
  ChevronRight,
  Zap,
  Plus,
  User,
  Leaf
} from 'lucide-react';
import './Home.css';

interface UserData {
  usr_id: string;
  name: string;
  mobile: string;
  email: string;
}

const Home = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserData | null>(null);
  const [walletBalance, setWalletBalance] = useState(0.00);
  const [greeting, setGreeting] = useState('Hello');

  useEffect(() => {
    const token = localStorage.getItem('x-access-token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      navigate('/login');
      return;
    }

    try {
      setUser(JSON.parse(userData));
    } catch (err) {
      console.error('Error parsing user data:', err);
      navigate('/login');
    }

    // Set greeting based on time
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 17) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, [navigate]);

  const handleScanQR = () => {
    navigate('/charging');
  };

  if (!user) {
    return (
      <div className="home-loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  const firstName = user.name?.split(' ')[0] || 'User';

  return (
    <div className="home-page">
      {/* Header */}
      <header className="home-header">
        <div className="header-content">
          <div className="header-left">
            <p className="greeting-text">{greeting},</p>
            <h1 className="user-name">{firstName}! 👋</h1>
          </div>
          <button className="profile-btn" onClick={() => navigate('/profile')}>
            <User size={22} />
          </button>
        </div>
        <p className="tagline">
          <Leaf size={14} />
          <span>Charge Smart. Drive Far.</span>
        </p>
      </header>

      {/* Main Content */}
      <main className="home-content">
        {/* Wallet Balance Card */}
        <section className="wallet-card">
          <div className="wallet-header">
            <div className="wallet-icon-wrap">
              <Wallet size={24} />
            </div>
            <span className="wallet-label">Wallet Balance</span>
          </div>
          <div className="wallet-balance">
            <span className="currency">₹</span>
            <span className="amount">{walletBalance.toFixed(2)}</span>
          </div>
          <button className="add-money-btn" onClick={() => navigate('/wallet')}>
            <Plus size={22} />
            <span>Add Money</span>
          </button>
        </section>

        {/* Scan QR Button - Main CTA */}
        <section className="scan-section">
          <button className="scan-qr-btn" onClick={handleScanQR}>
            <div className="scan-icon-container">
              <div className="scan-ring ring-1"></div>
              <div className="scan-ring ring-2"></div>
              <div className="scan-icon">
                <QrCode size={40} strokeWidth={1.5} />
              </div>
            </div>
            <div className="scan-text">
              <span className="scan-title">Scan QR to Charge</span>
              <span className="scan-subtitle">Point camera at charging station QR</span>
            </div>
            <Zap className="scan-zap" size={24} />
          </button>
        </section>

        {/* Quick Shortcuts */}
        <section className="shortcuts-section">
          <h2 className="section-title">Quick Actions</h2>
          
          <div className="shortcuts-grid">
            <button className="shortcut-card" onClick={() => navigate('/charging')}>
              <div className="shortcut-icon" style={{ background: 'var(--ev-primary-soft)' }}>
                <MapPin size={22} style={{ color: 'var(--ev-primary)' }} />
              </div>
              <div className="shortcut-content">
                <span className="shortcut-title">Nearby Stations</span>
                <span className="shortcut-subtitle">Find charging points</span>
              </div>
              <ChevronRight size={20} className="shortcut-arrow" />
            </button>

            <button className="shortcut-card" onClick={() => navigate('/charging')}>
              <div className="shortcut-icon" style={{ background: 'var(--ev-info-soft)' }}>
                <History size={22} style={{ color: 'var(--ev-info)' }} />
              </div>
              <div className="shortcut-content">
                <span className="shortcut-title">Charging Historyyyyy</span>
                <span className="shortcut-subtitle">View past sessions</span>
              </div>
              <ChevronRight size={20} className="shortcut-arrow" />
            </button>

            <button className="shortcut-card" onClick={() => navigate('/profile')}>
              <div className="shortcut-icon" style={{ background: 'var(--ev-warning-soft)' }}>
                <HelpCircle size={22} style={{ color: 'var(--ev-warning)' }} />
              </div>
              <div className="shortcut-content">
                <span className="shortcut-title">Help & Support</span>
                <span className="shortcut-subtitle">24/7 assistance</span>
              </div>
              <ChevronRight size={20} className="shortcut-arrow" />
            </button>
          </div>
        </section>

        {/* Eco Impact Card */}
        <section className="eco-card">
          <div className="eco-icon">
            <Leaf size={24} />
          </div>
          <div className="eco-content">
            <span className="eco-title">Your Green Impact</span>
            <span className="eco-value">12.5 kg CO₂ saved this month</span>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Home;
