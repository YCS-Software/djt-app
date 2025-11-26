
import { useNavigate } from 'react-router-dom';
import EVHeader from '../../components/EVHeader';
import Card from '../../components/base/Card';
import './profile.css';

const menuItems = [
  { icon: 'ri-car-line', title: 'My Vehicles', subtitle: 'Manage your EVs', color: '#76B82A' },
  { icon: 'ri-history-line', title: 'Charging History', subtitle: 'View all sessions', color: '#52A01E' },
  { icon: 'ri-bookmark-line', title: 'Saved Stations', subtitle: 'Your favorites', color: '#9FD24A' },
  { icon: 'ri-coupon-line', title: 'Offers & Rewards', subtitle: 'Special deals', color: '#76B82A' },
  { icon: 'ri-settings-line', title: 'Settings', subtitle: 'App preferences', color: '#636e72' },
  { icon: 'ri-customer-service-line', title: 'Help & Support', subtitle: '24/7 assistance', color: '#636e72' },
  { icon: 'ri-information-line', title: 'About', subtitle: 'App information', color: '#636e72' }
];

export default function Profile() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{"name":"Guest","email":"","mobile":""}');

  const handleLogout = () => {
    localStorage.removeItem('x-access-token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen" style={{ background: '#F8F9FA' }}>
      <EVHeader 
        userName={user.name}
        batteryLevel={78}
        location="Sector 18, Gurugram"
        showBattery={false}
      />
      
      <div className="pt-32 pb-24 px-4 space-y-6">
        {/* Profile Header */}
        <Card className="ev-profile-card">
          <div className="flex items-center">
            <div className="ev-profile-avatar">
              <i className="ri-user-fill text-2xl"></i>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900">{user.name}</h3>
              <p className="text-gray-600 text-sm">{user.email}</p>
              <p className="text-gray-500 text-xs">{user.mobile}</p>
            </div>
            <button className="ev-edit-btn">
              <i className="ri-edit-line"></i>
            </button>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="ev-stat-card">
            <div className="ev-stat-icon" style={{ background: 'rgba(118, 184, 42, 0.1)' }}>
              <i className="ri-flashlight-line" style={{ color: '#76B82A' }}></i>
            </div>
            <p className="ev-stat-value">47</p>
            <p className="ev-stat-label">Sessions</p>
          </Card>
          <Card className="ev-stat-card">
            <div className="ev-stat-icon" style={{ background: 'rgba(82, 160, 30, 0.1)' }}>
              <i className="ri-battery-charging-line" style={{ color: '#52A01E' }}></i>
            </div>
            <p className="ev-stat-value">1,245</p>
            <p className="ev-stat-label">kWh Charged</p>
          </Card>
          <Card className="ev-stat-card">
            <div className="ev-stat-icon" style={{ background: 'rgba(159, 210, 74, 0.1)' }}>
              <i className="ri-money-rupee-circle-line" style={{ color: '#9FD24A' }}></i>
            </div>
            <p className="ev-stat-value">₹12,450</p>
            <p className="ev-stat-label">Total Spent</p>
          </Card>
        </div>

        {/* Menu Items */}
        <Card className="ev-menu-card">
          <div className="space-y-2">
            {menuItems.map((item, index) => (
              <button
                key={index}
                className="ev-menu-item"
                onMouseEnter={(e) => {
                  const icon = e.currentTarget.querySelector('.ev-menu-icon') as HTMLElement;
                  if (icon) {
                    icon.style.background = `${item.color}20`;
                    icon.style.borderColor = item.color;
                  }
                }}
                onMouseLeave={(e) => {
                  const icon = e.currentTarget.querySelector('.ev-menu-icon') as HTMLElement;
                  if (icon) {
                    icon.style.background = '#F8F9FA';
                    icon.style.borderColor = 'transparent';
                  }
                }}
              >
                <div className="ev-menu-icon" style={{ borderColor: 'transparent' }}>
                  <i className={item.icon} style={{ color: item.color }}></i>
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-gray-900 text-sm">{item.title}</p>
                  <p className="text-gray-500 text-xs">{item.subtitle}</p>
                </div>
                <i className="ri-arrow-right-s-line" style={{ color: item.color }}></i>
              </button>
            ))}
          </div>
        </Card>

        {/* Logout */}
        <button onClick={handleLogout} className="ev-logout-btn">
          <i className="ri-logout-box-line mr-2"></i>
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
