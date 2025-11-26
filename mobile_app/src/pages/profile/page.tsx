import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Phone, 
  Mail, 
  LogOut, 
  ChevronRight,
  HelpCircle,
  Info,
  Shield,
  ArrowLeft,
  Zap,
  Battery,
  IndianRupee
} from 'lucide-react';
import { profileService, type ProfileData } from '../../services/api/profileService';
import './profile.css';

export default function Profile() {
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('x-access-token');
    if (!token) {
      navigate('/login');
      return;
    }

    fetchProfileData();
  }, [navigate]);

  const fetchProfileData = async () => {
    try {
      setIsLoading(true);
      const data = await profileService.getProfile();
      setProfileData(data);
    } catch (error) {
      console.error('Error fetching profile data:', error);
      // Set dummy data on error
      setProfileData({
        user: {
          usr_id: 0,
          name: 'John Doe',
          email: 'john.doe@example.com',
          phone: '9666476298',
          created_at: new Date().toISOString()
        },
        stats: {
          total_sessions: 47,
          total_energy_kwh: 1245.5,
          total_spent: 12400.00,
          co2_saved_kg: 124.5
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('x-access-token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const menuItems = [
    { icon: HelpCircle, title: 'Help & Support', subtitle: '24/7 assistance', color: 'var(--ev-primary)' },
    { icon: Shield, title: 'Privacy Policy', subtitle: 'Your data is safe', color: 'var(--ev-info)' },
    { icon: Info, title: 'About', subtitle: 'App version 1.0.0', color: 'var(--ev-text-muted)' },
  ];

  const formatCurrency = (amount: number) => {
    if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(1)}K`;
    }
    return `₹${amount.toFixed(0)}`;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-IN');
  };

  if (isLoading) {
    return (
      <div className="profile-page">
        <div className="profile-loading">
          <div className="loading-spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return null;
  }

  const { user, stats } = profileData;

  return (
    <div className="profile-page">
      {/* Header */}
      <header className="profile-header">
        <button className="back-btn" onClick={() => navigate('/home')}>
          <ArrowLeft size={22} />
        </button>
        <h1 className="page-title">Profile</h1>
        <div className="header-spacer"></div>
      </header>

      {/* Main Content */}
      <main className="profile-content">
        {/* User Card */}
        <section className="user-card">
          <div className="avatar-container">
            <div className="avatar">
              <User size={36} />
            </div>
          </div>
          <h2 className="user-name">{user.name || 'User'}</h2>
          
          <div className="user-details">
            <div className="detail-item">
              <Phone size={18} />
              <span>{user.phone || 'Not provided'}</span>
            </div>
            <div className="detail-item">
              <Mail size={18} />
              <span>{user.email || 'Not provided'}</span>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="stats-section">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--ev-success-soft)', color: 'var(--ev-success)' }}>
              <Zap size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{formatNumber(stats.total_sessions)}</span>
              <span className="stat-label">Sessions</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--ev-info-soft)', color: 'var(--ev-info)' }}>
              <Battery size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{formatNumber(stats.total_energy_kwh)}</span>
              <span className="stat-label">kWh</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--ev-warning-soft)', color: 'var(--ev-warning)' }}>
              <IndianRupee size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{formatCurrency(stats.total_spent)}</span>
              <span className="stat-label">Spent</span>
            </div>
          </div>
        </section>

        {/* Menu Items */}
        <section className="menu-section">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button key={index} className="menu-item">
                <div className="menu-icon" style={{ color: item.color }}>
                  <Icon size={20} />
                </div>
                <div className="menu-content">
                  <span className="menu-title">{item.title}</span>
                  <span className="menu-subtitle">{item.subtitle}</span>
                </div>
                <ChevronRight size={20} className="menu-arrow" />
              </button>
            );
          })}
        </section>

        {/* Logout Button */}
        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </main>
    </div>
  );
}
