import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  QrCode, 
  Zap, 
  MapPin, 
  Square,
  Battery,
  Clock,
  IndianRupee,
  Wallet,
  CheckCircle,
  AlertCircle,
  Sun,
  Camera,
  Star,
  History,
  ArrowLeft
} from 'lucide-react';
import { stationService } from '../../services/api/stationService';
import { sessionService } from '../../services/api/sessionService';
import type { ChargingStation } from '../../services/api/stationService';
import type { ChargingSession } from '../../services/api/sessionService';
import StationMap from '../../components/StationMap';
import './charging.css';

type ChargingState = 'idle' | 'scanning' | 'station-details' | 'charging' | 'completed';

interface StationInfo {
  name: string;
  chargerId: string;
  pricePerUnit: number;
  address: string;
  power: string;
}

export default function Charging() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view'); // 'stations' | 'history' | null
  
  const [state, setState] = useState<ChargingState>('idle');
  const [stationInfo, setStationInfo] = useState<StationInfo | null>(null);
  const [selectedUnits, setSelectedUnits] = useState(10);
  const [walletBalance] = useState(520.00);
  
  // Charging state
  const [unitsPurchased, setUnitsPurchased] = useState(0);
  const [unitsConsumed, setUnitsConsumed] = useState(0);
  const [chargingTime, setChargingTime] = useState(0);
  const [isCharging, setIsCharging] = useState(false);

  // Stations & History data
  const [stations, setStations] = useState<ChargingStation[]>([]);
  const [sessions, setSessions] = useState<ChargingSession[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Map state
  const [showMap, setShowMap] = useState(false);
  const [selectedStation, setSelectedStation] = useState<ChargingStation | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('x-access-token');
    if (!token) {
      navigate('/login');
      return;
    }

    // Get user location
    getUserLocation();

    // Fetch data based on view
    if (view === 'stations') {
      fetchStations();
    } else if (view === 'history') {
      fetchHistory();
    }
  }, [navigate, view]);

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.log('Error getting location:', error);
          // Use default location (Gurugram)
          setUserLocation({
            latitude: 28.4595,
            longitude: 77.0266
          });
        }
      );
    } else {
      // Use default location
      setUserLocation({
        latitude: 28.4595,
        longitude: 77.0266
      });
    }
  };

  const fetchStations = async () => {
    try {
      setLoading(true);
      // Try to get user location or use default
      const defaultLat = 28.4595;
      const defaultLng = 77.0266;
      const data = await stationService.getNearbyStations(defaultLat, defaultLng, 50);
      setStations(data);
    } catch (error) {
      console.error('Error fetching stations:', error);
      setStations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await sessionService.getSessionHistory(50, 0);
      setSessions(data);
    } catch (error) {
      console.error('Error fetching history:', error);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  // Charging timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCharging && unitsConsumed < unitsPurchased) {
      interval = setInterval(() => {
        setChargingTime(prev => prev + 1);
        setUnitsConsumed(prev => {
          const next = prev + 0.1;
          if (next >= unitsPurchased) {
            setIsCharging(false);
            setState('completed');
            return unitsPurchased;
          }
          return next;
        });
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isCharging, unitsConsumed, unitsPurchased]);

  const handleScanQR = () => {
    setState('scanning');
    
    // Simulate QR scanning
    setTimeout(() => {
      setStationInfo({
        name: 'DJT HAIKA PowerHub',
        chargerId: 'CHG-23456',
        pricePerUnit: 7.50,
        address: 'Mall Road, Sector 18',
        power: '150kW'
      });
      setState('station-details');
    }, 2000);
  };

  const getTotalPrice = () => {
    if (!stationInfo) return 0;
    return selectedUnits * stationInfo.pricePerUnit;
  };

  const canPay = () => {
    return getTotalPrice() <= walletBalance;
  };

  const handlePayAndStart = () => {
    if (!canPay()) return;
    
    setUnitsPurchased(selectedUnits);
    setUnitsConsumed(0);
    setChargingTime(0);
    setIsCharging(true);
    setState('charging');
  };

  const handleStopCharging = () => {
    setIsCharging(false);
    setState('completed');
  };

  const handleDone = () => {
    setState('idle');
    setStationInfo(null);
    setSelectedUnits(10);
    setUnitsPurchased(0);
    setUnitsConsumed(0);
    setChargingTime(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgress = () => {
    if (unitsPurchased === 0) return 0;
    return (unitsConsumed / unitsPurchased) * 100;
  };

  return (
    <div className="charging-page">
      {/* Header */}
      <header className="charging-header">
        <div className="header-content">
          {view && (
            <button className="back-btn" onClick={() => navigate('/home')}>
              <ArrowLeft size={20} />
            </button>
          )}
          <h1 className="page-title">
            {view === 'stations' ? 'Nearby Stations' : view === 'history' ? 'Charging History' : 'Charging'}
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="charging-content">
        {/* STATIONS VIEW */}
        {view === 'stations' && (
          <div className="stations-view">
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Loading stations...</p>
              </div>
            ) : stations.length > 0 ? (
              <div className="stations-list">
                {stations.map((station) => (
                  <div key={station.station_id} className="station-card" onClick={() => {
                    // Show map with directions
                    setSelectedStation(station);
                    setShowMap(true);
                  }}>
                    <div className="station-icon">
                      <Battery size={24} />
                    </div>
                    <div className="station-info">
                      <h3 className="station-name">{station.name}</h3>
                      <p className="station-address">{station.address}</p>
                      <div className="station-meta">
                        {station.distance && (
                          <span className="station-distance">
                            <MapPin size={12} />
                            {station.distance} km
                          </span>
                        )}
                        <span className="station-rating">
                          <Star size={12} />
                          {station.rating}
                        </span>
                        <span className={`station-chargers ${station.available_chargers > 0 ? 'available' : 'full'}`}>
                          {station.available_chargers}/{station.total_chargers} available
                        </span>
                      </div>
                    </div>
                    <div className="station-price">
                      <span className="price-value">₹{station.price_per_kwh}</span>
                      <span className="price-unit">/kWh</span>
                      {station.is_fast_charging && <span className="fast-badge">Fast</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <MapPin size={48} />
                <p>No stations found nearby</p>
              </div>
            )}
          </div>
        )}

        {/* HISTORY VIEW */}
        {view === 'history' && (
          <div className="history-view">
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Loading history...</p>
              </div>
            ) : sessions.length > 0 ? (
              <div className="sessions-list">
                {sessions.map((session) => (
                  <div key={session.session_id} className="session-card">
                    <div className="session-icon">
                      <Zap size={24} />
                    </div>
                    <div className="session-info">
                      <h3 className="session-station">{session.station_name}</h3>
                      <div className="session-meta">
                        <span className="session-date">{formatDate(session.start_time)}</span>
                        {session.duration_minutes && (
                          <span className="session-duration">
                            <Clock size={12} />
                            {session.duration_minutes} min
                          </span>
                        )}
                        <span className="session-energy">{session.energy_consumed?.toFixed(1) || 0} kWh</span>
                      </div>
                    </div>
                    <div className="session-cost">
                      <span className="cost-value">₹{session.total_cost?.toFixed(0) || session.current_cost?.toFixed(0) || 0}</span>
                      <span className={`status-badge ${session.status}`}>{session.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <History size={48} />
                <p>No charging history yet</p>
              </div>
            )}
          </div>
        )}

        {/* DEFAULT VIEW - QR Scan Flow */}
        {!view && (
          <>
            {/* IDLE STATE - Scan QR */}
            {state === 'idle' && (
          <div className="idle-state">
            <section className="scan-card">
              <div className="scan-illustration">
                <div className="phone-frame">
                  <Camera size={32} />
                </div>
                <div className="qr-frame">
                  <QrCode size={48} />
                </div>
              </div>
              <h2 className="scan-title">Scan QR to Start</h2>
              <p className="scan-subtitle">Point your camera at the QR code on the charging station</p>
              <div className="scan-instructions">
                <div className="instruction-item">
                  <Sun size={16} />
                  <span>Ensure good lighting</span>
                </div>
                <div className="instruction-item">
                  <Camera size={16} />
                  <span>Hold steady</span>
                </div>
              </div>
              <button className="scan-btn" onClick={handleScanQR}>
                <QrCode size={22} />
                <span>Scan QR Code</span>
              </button>
            </section>
          </div>
        )}

        {/* SCANNING STATE */}
        {state === 'scanning' && (
          <div className="scanning-state">
            <div className="scanner-animation">
              <div className="scanner-frame">
                <div className="scanner-line"></div>
              </div>
              <p className="scanning-text">Scanning...</p>
            </div>
          </div>
        )}

        {/* STATION DETAILS STATE */}
        {state === 'station-details' && stationInfo && (
          <div className="station-details-state">
            <section className="station-card">
              <div className="station-header">
                <div className="station-icon-wrap">
                  <Zap size={24} />
                </div>
                <div className="station-info">
                  <h2 className="station-name">{stationInfo.name}</h2>
                  <p className="station-id">Charger ID: {stationInfo.chargerId}</p>
                </div>
              </div>
              <div className="station-meta">
                <div className="meta-item">
                  <MapPin size={16} />
                  <span>{stationInfo.address}</span>
                </div>
                <div className="meta-item">
                  <Zap size={16} />
                  <span>{stationInfo.power}</span>
                </div>
              </div>
              <div className="price-badge">
                <IndianRupee size={16} />
                <span>{stationInfo.pricePerUnit.toFixed(2)} per Unit</span>
              </div>
            </section>

            <section className="purchase-card">
              <h3 className="purchase-title">Select Units to Charge</h3>
              
              <div className="slider-container">
                <div className="slider-value">
                  <span className="value-number">{selectedUnits}</span>
                  <span className="value-label">Units</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={selectedUnits}
                  onChange={(e) => setSelectedUnits(parseInt(e.target.value))}
                  className="unit-slider"
                />
                <div className="slider-range">
                  <span>1</span>
                  <span>50</span>
                </div>
              </div>

              <div className="total-price">
                <span className="price-label">Total Amount</span>
                <span className="price-value">₹{getTotalPrice().toFixed(2)}</span>
              </div>

              <div className="wallet-info">
                <Wallet size={18} />
                <span>Wallet Balance: ₹{walletBalance.toFixed(2)}</span>
              </div>

              {!canPay() && (
                <div className="insufficient-warning">
                  <AlertCircle size={18} />
                  <span>Insufficient balance. Please add money.</span>
                </div>
              )}

              <button 
                className="pay-btn"
                onClick={handlePayAndStart}
                disabled={!canPay()}
              >
                <Wallet size={20} />
                <span>Pay from Wallet</span>
              </button>
            </section>
          </div>
        )}

        {/* CHARGING STATE */}
        {state === 'charging' && stationInfo && (
          <div className="charging-state">
            <section className="charging-active-card">
              <div className="charging-status">
                <div className="status-icon charging">
                  <Zap size={32} />
                </div>
                <h2 className="status-title">Charging in Progress</h2>
                <p className="status-subtitle">{stationInfo.name}</p>
              </div>

              <div className="progress-section">
                <div className="progress-ring">
                  <svg viewBox="0 0 100 100">
                    <circle
                      className="progress-bg"
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      strokeWidth="8"
                    />
                    <circle
                      className="progress-fill"
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      strokeWidth="8"
                      strokeDasharray={`${2 * Math.PI * 45}`}
                      strokeDashoffset={`${2 * Math.PI * 45 * (1 - getProgress() / 100)}`}
                    />
                  </svg>
                  <div className="progress-center">
                    <span className="progress-percent">{Math.round(getProgress())}%</span>
                    <span className="progress-label">Complete</span>
                  </div>
                </div>
              </div>

              <div className="charging-stats">
                <div className="stat-item">
                  <Battery size={20} />
                  <div className="stat-content">
                    <span className="stat-value">{unitsConsumed.toFixed(1)}/{unitsPurchased}</span>
                    <span className="stat-label">Units</span>
                  </div>
                </div>
                <div className="stat-item">
                  <Clock size={20} />
                  <div className="stat-content">
                    <span className="stat-value">{formatTime(chargingTime)}</span>
                    <span className="stat-label">Time</span>
                  </div>
                </div>
                <div className="stat-item">
                  <IndianRupee size={20} />
                  <div className="stat-content">
                    <span className="stat-value">₹{(unitsConsumed * (stationInfo?.pricePerUnit || 0)).toFixed(0)}</span>
                    <span className="stat-label">Cost</span>
                  </div>
                </div>
              </div>

              <button className="stop-btn" onClick={handleStopCharging}>
                <Square size={20} />
                <span>Stop Charging</span>
              </button>
            </section>
          </div>
        )}

        {/* COMPLETED STATE */}
        {state === 'completed' && stationInfo && (
          <div className="completed-state">
            <section className="completed-card">
              <div className="completed-icon">
                <CheckCircle size={64} />
              </div>
              <h2 className="completed-title">Charging Complete!</h2>
              
              <div className="summary-card">
                <div className="summary-row">
                  <span className="summary-label">Station</span>
                  <span className="summary-value">{stationInfo.name}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Units Charged</span>
                  <span className="summary-value">{unitsConsumed.toFixed(1)} Units</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Duration</span>
                  <span className="summary-value">{formatTime(chargingTime)}</span>
                </div>
                <div className="summary-divider"></div>
                <div className="summary-row total">
                  <span className="summary-label">Total Paid</span>
                  <span className="summary-value">₹{(unitsConsumed * stationInfo.pricePerUnit).toFixed(2)}</span>
                </div>
              </div>

              <button className="done-btn" onClick={handleDone}>
                <span>Done</span>
              </button>
            </section>
          </div>
        )}
          </>
        )}
      </main>

      {/* Station Map Modal */}
      {showMap && selectedStation && (
        <StationMap
          station={selectedStation}
          userLocation={userLocation || undefined}
          onClose={() => {
            setShowMap(false);
            setSelectedStation(null);
          }}
        />
      )}
    </div>
  );
}
