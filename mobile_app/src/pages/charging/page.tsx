import { useState, useEffect, useCallback } from 'react';
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
  ArrowLeft,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { stationService } from '../../services/api/stationService';
import { sessionService } from '../../services/api/sessionService';
import { walletService } from '../../services/api/walletService';
import type { ChargingStation } from '../../services/api/stationService';
import type { ChargingSession } from '../../services/api/sessionService';
import StationMap from '../../components/StationMap';
import './charging.css';

type ChargingState = 'idle' | 'scanning' | 'station-details' | 'charging' | 'completed';

interface StationInfo {
  station_id: number;
  name: string;
  chargerId: string;
  connector_id: number;
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
  const [walletBalance, setWalletBalance] = useState(0.00);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  
  // Charging state
  const [unitsPurchased, setUnitsPurchased] = useState(0);
  const [unitsConsumed, setUnitsConsumed] = useState(0);
  const [chargingTime, setChargingTime] = useState(0);
  const [isCharging, setIsCharging] = useState(false);
  const [prepaidAmount, setPrepaidAmount] = useState(0);

  // Stations & History data
  const [stations, setStations] = useState<ChargingStation[]>([]);
  const [sessions, setSessions] = useState<ChargingSession[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Map state
  const [showMap, setShowMap] = useState(false);
  const [selectedStation, setSelectedStation] = useState<ChargingStation | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  
  // Expanded session state
  const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('x-access-token');
    if (!token) {
      navigate('/login');
      return;
    }

    // Get user location
    getUserLocation();

    // Fetch wallet balance
    fetchWalletBalance();

    // Fetch data based on view
    if (view === 'stations') {
      fetchStations();
    } else if (view === 'history') {
      fetchHistory();
    }
  }, [navigate, view]);

  const fetchWalletBalance = async () => {
    try {
      const balanceData = await walletService.getBalance();
      setWalletBalance(balanceData.balance || 0);
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      setWalletBalance(0);
    }
  };

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
          // Use default location (Rajahmundry, Andhra Pradesh)
          setUserLocation({
            latitude: 17.0000,
            longitude: 81.7833
          });
        }
      );
    } else {
      // Use default location (Rajahmundry, Andhra Pradesh)
      setUserLocation({
        latitude: 17.0000,
        longitude: 81.7833
      });
    }
  };

  const fetchStations = async () => {
    try {
      setLoading(true);
      // Use user location or default (Rajahmundry, Andhra Pradesh)
      const lat = userLocation?.latitude || 17.0000;
      const lng = userLocation?.longitude || 81.7833;
      const data = await stationService.getNearbyStations(lat, lng, 50);
      // Only set stations if we have real data from API
      if (data && Array.isArray(data) && data.length > 0) {
        setStations(data);
      } else {
        setStations([]);
      }
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

  const handleStopCharging = useCallback(async () => {
    if (!currentSessionId) {
      setIsCharging(false);
      setState('completed');
      return;
    }

    try {
      setLoading(true);
      
      // Calculate actual values from current state
      const actualChargedUnits = unitsConsumed;
      const actualChargedCost = stationInfo ? unitsConsumed * stationInfo.pricePerUnit : 0;
      const actualIsFullyCompleted = unitsConsumed >= unitsPurchased;
      
      // Stop session via API - backend will calculate refund (prepaid - charged) and add to wallet
      const stoppedSession = await sessionService.stopSession({
        session_id: currentSessionId,
        charged_units: actualChargedUnits,
        charged_cost: actualChargedCost,
        is_fully_completed: actualIsFullyCompleted
      });

      if (stoppedSession) {
        setIsCharging(false);
        setState('completed');
        
        // Refresh wallet balance after payment/refund
        await fetchWalletBalance();
      } else {
        throw new Error('Failed to stop session');
      }
    } catch (error: any) {
      console.error('Error stopping charging session:', error);
      alert(error.message || 'Failed to stop charging session. Please try again.');
      // Still update UI even if API fails
      setIsCharging(false);
      setState('completed');
    } finally {
      setLoading(false);
    }
  }, [currentSessionId, unitsConsumed, unitsPurchased, stationInfo, fetchWalletBalance]);

  // Charging timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCharging && unitsConsumed < unitsPurchased) {
      interval = setInterval(() => {
        setChargingTime(prev => prev + 1);
        setUnitsConsumed(prev => {
          const next = prev + 0.1;
          if (next >= unitsPurchased) {
            // Charging reached 100% - automatically stop session
            setIsCharging(false);
            // Call stopSession API automatically when 100% complete
            handleStopCharging();
            return unitsPurchased;
          }
          return next;
        });
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isCharging, unitsConsumed, unitsPurchased, handleStopCharging]);

  const handleScanQR = async () => {
    setState('scanning');
    
    try {
      // Simulate QR scanning - In real app, this would use camera API
      // QR code would contain station_id and connector_id
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // For testing: Check if scanned code is DJT001
      // In real app, this would come from QR scanner
      const scannedCode = 'DJT001'; // Test code - replace with actual QR scanner result
      
      // Fetch nearby stations if not already loaded
      if (stations.length === 0) {
        const lat = userLocation?.latitude || 17.0000;
        const lng = userLocation?.longitude || 81.7833;
        const nearbyStations = await stationService.getNearbyStations(lat, lng, 50);
        setStations(nearbyStations);
      }
      
      let targetStation: ChargingStation | null = null;
      
      // If scanned code is DJT001 (for testing), find that station
      if (scannedCode === 'DJT001') {
        // Search for station with code DJT001
        targetStation = stations.find(s => s.code === 'DJT001') || null;
        
        // If not found in nearby stations, try searching
        if (!targetStation) {
          try {
            const searchResults = await stationService.searchStations('DJT001');
            targetStation = searchResults.find((s: ChargingStation) => s.code === 'DJT001') || null;
          } catch (searchError) {
            console.log('Search failed, trying nearby stations');
          }
        }
        
        // If still not found, use first station from nearby
        if (!targetStation && stations.length > 0) {
          targetStation = stations[0];
        }
      } else {
        // For other codes or normal flow, use first available station
        targetStation = stations.length > 0 ? stations[0] : null;
      }
      
      if (!targetStation || !targetStation.station_id) {
        alert('Station not found. Please ensure the QR code is valid or try again.');
        setState('idle');
        return;
      }
      
      // Fetch station details with connectors from API
      const stationDetails = await stationService.getStationDetails(targetStation.station_id);
      
      if (!stationDetails || !stationDetails.connectors || stationDetails.connectors.length === 0) {
        alert('No available connectors at this station. Please try another station.');
        setState('idle');
        return;
      }
      
      // Get first available connector
      const availableConnector = stationDetails.connectors.find((c: any) => c.is_available) || stationDetails.connectors[0];
      
      if (!availableConnector || !availableConnector.connector_id) {
        alert('No available connectors. Please try another station.');
        setState('idle');
        return;
      }
      
      // Set station info with real data from API
      setStationInfo({
        station_id: stationDetails.station_id,
        name: stationDetails.name,
        chargerId: stationDetails.code || `CHG-${stationDetails.station_id}`,
        connector_id: availableConnector.connector_id,
        pricePerUnit: stationDetails.price_per_kwh,
        address: stationDetails.address,
        power: stationDetails.power || availableConnector.power || '150kW'
      });
      setState('station-details');
    } catch (error: any) {
      console.error('Error scanning QR:', error);
      alert(error.message || 'Failed to scan QR code. Please try again.');
      setState('idle');
    }
  };

  const getTotalPrice = () => {
    if (!stationInfo) return 0;
    return selectedUnits * stationInfo.pricePerUnit;
  };

  const canPay = () => {
    const totalPrice = getTotalPrice();
    return totalPrice > 0 && totalPrice <= walletBalance;
  };

  const handlePayAndStart = async () => {
    if (!canPay() || !stationInfo) {
      alert('Insufficient wallet balance. Please add money to your wallet.');
      return;
    }

    if (!stationInfo.station_id || !stationInfo.connector_id) {
      alert('Invalid station or connector information. Please scan QR code again.');
      return;
    }

    try {
      setLoading(true);
      
      // Calculate total amount
      const totalAmount = getTotalPrice();
      
      // Start charging session via API with real station and connector IDs
      // Send selected units and total amount for wallet deduction
      const sessionData = await sessionService.startSession({
        station_id: stationInfo.station_id,
        connector_id: stationInfo.connector_id,
        qr_code: stationInfo.chargerId,
        selected_units: selectedUnits,
        total_amount: totalAmount
      });

      if (sessionData && sessionData.session_id) {
        setCurrentSessionId(sessionData.session_id);
        setUnitsPurchased(selectedUnits);
        setUnitsConsumed(0);
        setChargingTime(0);
        setIsCharging(true);
        setState('charging');
        setPrepaidAmount(totalAmount); // Store prepaid amount
        
        // Refresh wallet balance after payment deduction
        await fetchWalletBalance();
      } else {
        throw new Error('Failed to start session');
      }
    } catch (error: any) {
      console.error('Error starting charging session:', error);
      alert(error.message || 'Failed to start charging session. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  const handleDone = async () => {
    setState('idle');
    setStationInfo(null);
    setSelectedUnits(10);
    setUnitsPurchased(0);
    setUnitsConsumed(0);
    setChargingTime(0);
    setCurrentSessionId(null);
    setPrepaidAmount(0);
    
    // Refresh wallet balance
    await fetchWalletBalance();
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
                {sessions.map((session) => {
                  const isExpanded = expandedSessionId === session.session_id;
                  return (
                    <div key={session.session_id} className={`session-card ${isExpanded ? 'expanded' : ''}`}>
                      <div className="session-card-header" onClick={() => setExpandedSessionId(isExpanded ? null : session.session_id)}>
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
                          <span className="cost-value">₹{session.cost?.toFixed(0) || 0}</span>
                          <span className={`status-badge ${session.status}`}>{session.status}</span>
                        </div>
                        <button 
                          className="expand-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedSessionId(isExpanded ? null : session.session_id);
                          }}
                        >
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                      </div>
                      
                      {isExpanded && (
                        <div className="session-details-expanded">
                          <div className="detail-row">
                            <span className="detail-label">Session ID:</span>
                            <span className="detail-value">{session.session_id}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Station:</span>
                            <span className="detail-value">{session.station_name}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Date:</span>
                            <span className="detail-value">{session.date || formatDate(session.start_time)}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Start Time:</span>
                            <span className="detail-value">
                              {session.start_time ? new Date(session.start_time).toLocaleString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : 'N/A'}
                            </span>
                          </div>
                          {session.end_time && (
                            <div className="detail-row">
                              <span className="detail-label">End Time:</span>
                              <span className="detail-value">
                                {new Date(session.end_time).toLocaleString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          )}
                          <div className="detail-row">
                            <span className="detail-label">Duration:</span>
                            <span className="detail-value">{session.duration_minutes || 0} minutes</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Energy Consumed:</span>
                            <span className="detail-value">{session.energy_consumed?.toFixed(2) || 0} kWh</span>
                          </div>
                          {session.price_per_kwh && (
                            <div className="detail-row">
                              <span className="detail-label">Price per kWh:</span>
                              <span className="detail-value">₹{session.price_per_kwh.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="detail-row">
                            <span className="detail-label">Total Cost:</span>
                            <span className="detail-value">₹{session.cost?.toFixed(2) || session.total_cost?.toFixed(2) || 0}</span>
                          </div>
                          {session.connector_type && (
                            <div className="detail-row">
                              <span className="detail-label">Connector Type:</span>
                              <span className="detail-value">{session.connector_type}</span>
                            </div>
                          )}
                          <div className="detail-row">
                            <span className="detail-label">Status:</span>
                            <span className={`detail-value status-text ${session.status}`}>{session.status}</span>
                          </div>
                          {session.payment_status && (
                            <div className="detail-row">
                              <span className="detail-label">Payment Status:</span>
                              <span className={`detail-value status-text ${session.payment_status}`}>{session.payment_status}</span>
                            </div>
                          )}
                          {session.session_code && (
                            <div className="detail-row">
                              <span className="detail-label">Session Code:</span>
                              <span className="detail-value">{session.session_code}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
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
            <section className="station-info-card">
              <h2 className="station-name">{stationInfo.name}</h2>
              <div className="station-meta">
                <div className="meta-item">
                  <MapPin size={16} />
                  <span>{stationInfo.address}</span>
                </div>
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
                <div className="summary-row">
                  <span className="summary-label">Prepaid Amount</span>
                  <span className="summary-value">₹{prepaidAmount.toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Charged Amount</span>
                  <span className="summary-value">₹{(unitsConsumed * stationInfo.pricePerUnit).toFixed(2)}</span>
                </div>
                {prepaidAmount > (unitsConsumed * stationInfo.pricePerUnit) && (
                  <div className="summary-row refund-row">
                    <span className="summary-label">
                      <Wallet size={16} style={{ display: 'inline-block', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                      Refund Amount
                    </span>
                    <span className="summary-value refund-value">
                      ₹{(prepaidAmount - (unitsConsumed * stationInfo.pricePerUnit)).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="summary-divider"></div>
                <div className="summary-row total">
                  <span className="summary-label">Total Charged</span>
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
