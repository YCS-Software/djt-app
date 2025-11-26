import { Battery, Bell, MapPin, User, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './EVHeader.css';

interface EVHeaderProps {
  userName?: string;
  batteryLevel?: number;
  location?: string;
  showBattery?: boolean;
}

const EVHeader = ({ 
  userName = 'Guest',
  batteryLevel = 75,
  location = 'Current Location',
  showBattery = true 
}: EVHeaderProps) => {
  const navigate = useNavigate();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getBatteryColor = () => {
    if (batteryLevel > 60) return '#76B82A';
    if (batteryLevel > 20) return '#f39c12';
    return '#e74c3c';
  };

  return (
    <div className="ev-header">
      <div className="ev-header-gradient"></div>
      
      <div className="ev-header-content">
        {/* Top Row - User & Notifications */}
        <div className="ev-header-top">
          <div className="ev-user-section">
            <div className="ev-user-avatar" onClick={() => navigate('/profile')}>
              <User size={20} />
            </div>
            <div className="ev-user-info">
              <span className="ev-greeting">{getGreeting()}!</span>
              <span className="ev-user-name">{userName}</span>
            </div>
          </div>

          <div className="ev-header-actions">
            {showBattery && (
              <div className="ev-battery-indicator">
                <Battery 
                  size={20} 
                  style={{ color: getBatteryColor() }}
                  className="ev-battery-icon"
                />
                <span className="ev-battery-level">{batteryLevel}%</span>
              </div>
            )}
            <button className="ev-notification-btn">
              <Bell size={20} />
              <span className="ev-notification-badge">3</span>
            </button>
          </div>
        </div>

        {/* Bottom Row - Location & Branding */}
        <div className="ev-header-bottom">
          <div className="ev-location">
            <MapPin size={16} className="ev-location-icon" />
            <span className="ev-location-text">{location}</span>
          </div>
          
          <div className="ev-branding">
            <Zap size={16} className="ev-brand-icon pulse-icon" />
            <span className="ev-brand-text">EV Charging</span>
          </div>
        </div>
      </div>

      {/* Charging Pulse Effect */}
      <div className="ev-header-pulse"></div>
    </div>
  );
};

export default EVHeader;
