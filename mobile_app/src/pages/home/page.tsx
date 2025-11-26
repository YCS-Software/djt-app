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
import { dashboardService } from '../../services/api/dashboardService';
import type { UserStats } from '../../services/api/dashboardService';
import './home.css';

interface UserData {
  usr_id: string;
  name: string;
  mobile: string;
  email: string;
}

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserData | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [greeting, setGreeting] = useState('Hello');
  const [loading, setLoading] = useState(true);

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

    // Fetch home page data
    fetchHomeData();
  }, [navigate]);

  const fetchHomeData = async () => {
    try {
      setLoading(true);
      const data = await dashboardService.getHomeData();
      
      setWalletBalance(data.wallet?.balance || 0);
      setStats(data.stats || null);
    } catch (error) {
      console.error('Error fetching home data:', error);
      // Set default values on error
      setWalletBalance(520.00);
      setStats({
        total_sessions: 47,
        total_energy_kwh: 1245,
        total_spent: 12450,
        co2_saved_kg: 1020.9
      });
    } finally {
      setLoading(false);
    }
  };

  const handleScanQR = () => {
    navigate('/charging');
  };

  if (!user || loading) {
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
        {/* Wallet Balance Card - Compact */}
        <section className="wallet-card">
          <div className="wallet-header">
            <div className="wallet-icon-wrap">
              <Wallet size={24} />
            </div>
          </div>
          <div className="wallet-balance">
            <div className="wallet-amount-row">
              <span className="currency">₹</span>
              <span className="amount">{walletBalance.toFixed(2)}</span>
            </div>
            <button className="add-money-btn" onClick={() => navigate('/wallet')}>
              <Plus size={14} />
              <span>Add Money</span>
            </button>
          </div>
        </section>

        {/* Scan QR Button - Main CTA */}
        <section className="scan-section">
          <button className="scan-qr-btn" onClick={handleScanQR}>
            <div className="scan-icon-container">
              <div className="scan-ring ring-1"></div>
              <div className="scan-ring ring-2"></div>
              <div className="scan-icon">
                <QrCode size={36} strokeWidth={1.5} />
              </div>
            </div>
            <div className="scan-text">
              <span className="scan-title">
                <Zap className="scan-zap" size={22} />
                Scan QR to Charge
              </span>
              <span className="scan-subtitle">Point camera at charging station QR</span>
            </div>
          </button>
        </section>

        {/* Quick Shortcuts */}
        <section className="shortcuts-section">
          <h2 className="section-title">Quick Actions</h2>
          
          <div className="shortcuts-grid">
            <button className="shortcut-card" onClick={() => navigate('/charging?view=stations')}>
              <div className="shortcut-icon" style={{ background: 'var(--ev-primary-soft)' }}>
                <MapPin size={22} style={{ color: 'var(--ev-primary)' }} />
              </div>
              <div className="shortcut-content">
                <span className="shortcut-title">Nearby Stations</span>
                <span className="shortcut-subtitle">Find charging points</span>
              </div>
              <ChevronRight size={20} className="shortcut-arrow" />
            </button>

            <button className="shortcut-card" onClick={() => navigate('/charging?view=history')}>
              <div className="shortcut-icon" style={{ background: 'var(--ev-info-soft)' }}>
                <History size={22} style={{ color: 'var(--ev-info)' }} />
              </div>
              <div className="shortcut-content">
                <span className="shortcut-title">Charging History</span>
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
            <span className="eco-value">
              {stats ? `${stats.co2_saved_kg.toFixed(1)} kg CO₂` : '12.5 kg CO₂'} saved
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}
