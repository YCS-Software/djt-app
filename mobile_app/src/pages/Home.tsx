import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Phone, Mail, Shield } from 'lucide-react';
import './Home.css';

interface UserData {
  usr_id: string;
  name: string;
  mobile: string;
  email: string;
  role: string;
}

const Home = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserData | null>(null);

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
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('x-access-token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="home-container">
      <div className="home-card">
        <div className="home-header">
          <div className="avatar">
            <User size={48} />
          </div>
          <h1>Welcome Back!</h1>
          <p className="welcome-text">You're successfully logged in</p>
        </div>

        <div className="user-info">
          <div className="info-item">
            <div className="info-icon">
              <User size={20} />
            </div>
            <div className="info-content">
              <span className="info-label">Name</span>
              <span className="info-value">{user.name}</span>
            </div>
          </div>

          <div className="info-item">
            <div className="info-icon">
              <Phone size={20} />
            </div>
            <div className="info-content">
              <span className="info-label">Mobile</span>
              <span className="info-value">{user.mobile}</span>
            </div>
          </div>

          <div className="info-item">
            <div className="info-icon">
              <Mail size={20} />
            </div>
            <div className="info-content">
              <span className="info-label">Email</span>
              <span className="info-value">{user.email}</span>
            </div>
          </div>

          <div className="info-item">
            <div className="info-icon">
              <Shield size={20} />
            </div>
            <div className="info-content">
              <span className="info-label">Role</span>
              <span className="info-value capitalize">{user.role}</span>
            </div>
          </div>
        </div>

        <button onClick={handleLogout} className="logout-btn">
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Home;
