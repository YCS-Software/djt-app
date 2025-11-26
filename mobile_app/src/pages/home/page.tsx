import EVHeader from '../../components/EVHeader';
import WalletCard from './components/WalletCard';
import QRScanner from './components/QRScanner';
import QuickActions from './components/QuickActions';
import ChargingSessions from './components/ChargingSessions';
import Dashboard from './components/Dashboard';
import './home.css';

export default function Home() {
  const user = JSON.parse(localStorage.getItem('user') || '{"name":"Guest"}');
  
  return (
    <div className="min-h-screen ev-home-page">
      <EVHeader 
        userName={user.name}
        batteryLevel={78}
        location="Sector 18, Gurugram"
        showBattery={true}
      />
      
      <div className="pt-32 pb-24 px-4 space-y-6">

        {/* Dashboard Stats */}
        <Dashboard />

        {/* Wallet Balance */}
        <WalletCard />

        {/* QR Scanner */}
        <QRScanner />

        {/* Quick Actions */}
        <QuickActions />

        {/* Recent Charging Sessions */}
        <ChargingSessions />
      </div>
    </div>
  );
}
