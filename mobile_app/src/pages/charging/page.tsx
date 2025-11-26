
import { useState } from 'react';
import EVHeader from '../../components/EVHeader';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import './charging.css';

const chargingStations = [
  {
    id: '1',
    name: 'DJT HAIKA PowerHub Mall Road',
    distance: '0.5 km',
    available: 3,
    total: 4,
    price: '₹10/kWh',
    rating: 4.5,
    fastCharging: true,
    connectorTypes: ['CCS2', 'CHAdeMO'],
    power: '150kW'
  },
  {
    id: '2',
    name: 'DJT HAIKA EcoCharge Central',
    distance: '1.2 km',
    available: 2,
    total: 6,
    price: '₹8/kWh',
    rating: 4.2,
    fastCharging: false,
    connectorTypes: ['Type 2', 'CCS2'],
    power: '22kW'
  },
  {
    id: '3',
    name: 'DJT HAIKA QuickCharge Express',
    distance: '2.1 km',
    available: 1,
    total: 3,
    price: '₹12/kWh',
    rating: 4.7,
    fastCharging: true,
    connectorTypes: ['CCS2', 'CHAdeMO', 'Type 2'],
    power: '350kW'
  },
  {
    id: '4',
    name: 'DJT HAIKA City Center Hub',
    distance: '3.5 km',
    available: 4,
    total: 8,
    price: '₹9/kWh',
    rating: 4.3,
    fastCharging: true,
    connectorTypes: ['CCS2', 'Type 2'],
    power: '120kW'
  }
];

export default function Charging() {
  const [activeTab, setActiveTab] = useState('nearby');
  const [isScanning, setIsScanning] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedStation, setSelectedStation] = useState<any>(null);
  const [favorites, setFavorites] = useState<string[]>(['1', '3']);
  const [searchQuery, setSearchQuery] = useState('');
  const [showChargingSession, setShowChargingSession] = useState(false);
  const [chargingProgress, setChargingProgress] = useState(0);
  const [isCharging, setIsCharging] = useState(false);

  const handleScanQR = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setShowChargingSession(true);
      setIsCharging(true);
      // Simulate charging progress
      const interval = setInterval(() => {
        setChargingProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsCharging(false);
            return 100;
          }
          return prev + 1;
        });
      }, 200);
    }, 2000);
  };

  const handleBookStation = (station: any) => {
    setSelectedStation(station);
    setShowBookingModal(true);
  };

  const handleToggleFavorite = (stationId: string) => {
    setFavorites(prev => 
      prev.includes(stationId) 
        ? prev.filter(id => id !== stationId)
        : [...prev, stationId]
    );
  };

  const handleNavigate = (station: any) => {
    window.open(`https://maps.google.com/?q=${encodeURIComponent(station.name)}`, '_blank');
  };

  const filteredStations = chargingStations.filter(station => {
    const matchesSearch = station.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'nearby' || (activeTab === 'favorites' && favorites.includes(station.id));
    return matchesSearch && matchesTab;
  });

  const stopCharging = () => {
    setIsCharging(false);
    setShowChargingSession(false);
    setChargingProgress(0);
  };

  const user = JSON.parse(localStorage.getItem('user') || '{"name":"Guest"}');

  return (
    <div className="min-h-screen ev-charging-page">
      <EVHeader 
        userName={user.name}
        batteryLevel={78}
        location="Find Stations"
        showBattery={true}
      />
      
      <div className="pt-32 pb-24 px-4 space-y-5">
        {/* Search Bar - Perfect Alignment */}
        <div className="relative w-full">
          <input
            type="text"
            placeholder="Search charging stations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ev-search-bar"
          />
          <i className="ri-search-line absolute left-4 top-1/2 transform -translate-y-1/2 text-xl" style={{color: '#76B82A'}}></i>
        </div>

        {/* Tab Switcher - Perfect Alignment */}
        <div className="ev-tab-container">
          <button
            onClick={() => setActiveTab('nearby')}
            className={`ev-tab-button ${activeTab === 'nearby' ? 'active' : ''}`}
          >
            Nearby
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`ev-tab-button ${activeTab === 'favorites' ? 'active' : ''}`}
          >
            Favorites
          </button>
        </div>

        {/* Quick Scan */}
        <Card className="ev-scan-card">
          <div className="ev-scan-icon">
            <i className={`ri-qr-scan-line text-3xl ${isScanning ? 'animate-pulse' : ''}`} style={{color: '#76B82A'}}></i>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Quick Start Charging</h3>
          <p className="text-gray-600 text-sm mb-4">Scan QR code at DJT HAIKA station to start charging instantly</p>
          <Button 
            className="w-full"
            onClick={handleScanQR}
            disabled={isScanning}
          >
            {isScanning ? (
              <>
                <i className="ri-loader-4-line animate-spin mr-2"></i>
                Scanning...
              </>
            ) : (
              <>
                <i className="ri-qr-scan-line mr-2"></i>
                Scan QR Code
              </>
            )}
          </Button>
        </Card>

        {/* Active Charging Session */}
        {showChargingSession && (
          <Card className="ev-charging-session">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Active Charging Session</h3>
              <span className="bg-white/20 px-2 py-1 rounded-full text-xs">
                {isCharging ? 'Charging' : 'Completed'}
              </span>
            </div>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Progress</span>
                <span>{chargingProgress}%</span>
              </div>
              <div className="ev-progress-bar">
                <div 
                  className="ev-progress-fill"
                  style={{ width: `${chargingProgress}%` }}
                ></div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center mb-4">
              <div>
                <p className="text-xs opacity-80">Energy</p>
                <p className="font-semibold">{(chargingProgress * 0.45).toFixed(1)} kWh</p>
              </div>
              <div>
                <p className="text-xs opacity-80">Cost</p>
                <p className="font-semibold">₹{(chargingProgress * 4.5).toFixed(0)}</p>
              </div>
              <div>
                <p className="text-xs opacity-80">Time</p>
                <p className="font-semibold">{Math.floor(chargingProgress / 2)}:{(chargingProgress % 2 * 30).toFixed(0).padStart(2, '0')}</p>
              </div>
            </div>
            {isCharging && (
              <Button 
                variant="secondary" 
                className="w-full bg-white/20 text-white border-0 hover:bg-white/30"
                onClick={stopCharging}
              >
                <i className="ri-stop-circle-line mr-2"></i>
                Stop Charging
              </Button>
            )}
          </Card>
        )}

        {/* Charging Stations List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {activeTab === 'favorites' ? 'Favorite Stations' : 'Available DJT HAIKA Stations'}
          </h3>
          {filteredStations.map((station) => (
            <Card key={station.id} className="ev-station-card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center mb-1">
                    <h4 className="font-semibold text-gray-900 mr-2">{station.name}</h4>
                    {station.fastCharging && (
                      <span className="ev-fast-badge">
                        ⚡ Fast
                      </span>
                    )}
                  </div>
                  <div className="flex items-center text-sm text-gray-600 mb-2">
                    <i className="ri-map-pin-line mr-1"></i>
                    <span className="mr-4">{station.distance}</span>
                    <i className="ri-star-fill text-yellow-400 mr-1"></i>
                    <span className="mr-4">{station.rating}</span>
                    <span className="ev-power-badge">
                      {station.power}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">
                      {station.available}/{station.total} available
                    </span>
                    <span className="font-semibold text-blue-600">{station.price}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {station.connectorTypes.map((type) => (
                      <span key={type} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
                <Button 
                  size="sm" 
                  className="ml-4"
                  onClick={() => handleNavigate(station)}
                >
                  Navigate
                </Button>
              </div>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => handleToggleFavorite(station.id)}
                >
                  <i className={`${favorites.includes(station.id) ? 'ri-bookmark-fill' : 'ri-bookmark-line'} mr-2`}></i>
                  {favorites.includes(station.id) ? 'Saved' : 'Save'}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => handleBookStation(station)}
                >
                  <i className="ri-calendar-line mr-2"></i>
                  Book
                </Button>
                <Button 
                  size="sm" 
                  className="flex-1"
                  onClick={handleScanQR}
                >
                  <i className="ri-flashlight-line mr-2"></i>
                  Charge
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && selectedStation && (
        <div className="fixed inset-0 ev-modal-overlay flex items-end z-50">
          <div className="ev-booking-modal w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Book Charging Slot</h3>
              <button 
                onClick={() => setShowBookingModal(false)}
                className="p-2"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">{selectedStation.name}</h4>
                <p className="text-sm text-gray-600">{selectedStation.distance} • {selectedStation.price}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
                <input 
                  type="date" 
                  className="w-full p-3 border border-gray-200 rounded-lg"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Time</label>
                <div className="grid grid-cols-3 gap-2">
                  {['09:00', '11:00', '13:00', '15:00', '17:00', '19:00'].map((time) => (
                    <button 
                      key={time}
                      className="ev-time-slot"
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Charging Duration</label>
                <select className="w-full p-3 border border-gray-200 rounded-lg">
                  <option>30 minutes</option>
                  <option>1 hour</option>
                  <option>2 hours</option>
                  <option>3 hours</option>
                </select>
              </div>
              
              <div className="flex space-x-3">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowBookingModal(false)}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1"
                  onClick={() => {
                    setShowBookingModal(false);
                    alert('Booking confirmed! You will receive a confirmation message shortly.');
                  }}
                >
                  Confirm Booking
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
