import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, CircleMarker } from 'react-leaflet';
import { Icon, DivIcon } from 'leaflet';
import type { LatLngExpression } from 'leaflet';
import L from 'leaflet';
import { Navigation, X, Clock, Route, Play, Square, RotateCcw, AlertCircle, CheckCircle, Volume2, VolumeX, ExternalLink } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import 'leaflet/dist/leaflet.css';
import './StationMap.css';
import {
  getRoute,
  type RouteData,
  type NavigationState,
  calculateRemainingRoute,
  isOnRoute,
  formatDistance,
  formatTime,
  cacheRoute,
  findNearestPointOnRoute,
} from '../services/navigationService';

interface StationMapProps {
  station: {
    station_id: number;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    distance?: number | string;
  };
  userLocation?: {
    latitude: number;
    longitude: number;
  };
  onClose: () => void;
}

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Red pin icon for start location (like Google Maps)
const startIcon = new Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 24 16 24s16-14 16-24C32 7.163 24.837 0 16 0z" fill="#EA4335"/>
      <circle cx="16" cy="16" r="8" fill="white"/>
      <circle cx="16" cy="16" r="5" fill="#EA4335"/>
    </svg>
  `),
  iconSize: [32, 40],
  iconAnchor: [16, 40],
  popupAnchor: [0, -40],
});

// Component to create route info bubble
function RouteInfoBubble({ route, position }: { route: RouteData; position: [number, number] }) {
  return (
    <Marker
      position={position}
      icon={new DivIcon({
        className: 'route-info-bubble',
        html: `
          <div class="route-bubble-content">
            <div class="route-bubble-icon">🚴</div>
            <div class="route-bubble-info">
              <div class="route-bubble-time">${formatTime(route.duration)}</div>
              <div class="route-bubble-distance">${formatDistance(route.distance)}</div>
            </div>
          </div>
        `,
        iconSize: [120, 50],
        iconAnchor: [60, 50],
      })}
    >
      <Popup>
        <div style={{ padding: '0.5rem', fontFamily: 'system-ui' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Route Option</div>
          <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>
            {formatTime(route.duration)} • {formatDistance(route.distance)}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

// Component to fit map bounds and update view
function MapController({
  userPos,
  stationPos,
  routePolylines,
  isNavigating,
  onMapReady,
}: {
  userPos: LatLngExpression;
  stationPos: LatLngExpression;
  routePolylines?: [number, number][][];
  isNavigating: boolean;
  onMapReady?: (map: L.Map) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (onMapReady) {
      onMapReady(map);
    }
  }, [map, onMapReady]);

  useEffect(() => {
    if (!map) return;

    try {
      const userLatLng = Array.isArray(userPos)
        ? L.latLng(userPos[0], userPos[1])
        : L.latLng((userPos as any).lat, (userPos as any).lng);
      const stationLatLng = Array.isArray(stationPos)
        ? L.latLng(stationPos[0], stationPos[1])
        : L.latLng((stationPos as any).lat, (stationPos as any).lng);

      if (isNavigating && routePolylines && routePolylines.length > 0 && routePolylines[0]) {
        // During navigation, center on user location with zoom
        map.setView(userLatLng, 16, { animate: true, duration: 0.5 });
      } else {
        // Before navigation, fit both markers
        const bounds = L.latLngBounds([userLatLng, stationLatLng]);
        if (routePolylines && routePolylines.length > 0) {
          // Include all routes in bounds
          routePolylines.forEach((polyline) => {
            polyline.forEach(([lat, lng]) => {
              bounds.extend([lat, lng]);
            });
          });
        }
        map.fitBounds(bounds, { padding: [100, 100], animate: true, duration: 0.5 });
      }
    } catch (error) {
      console.error('Error updating map view:', error);
    }
  }, [map, userPos, stationPos, routePolylines, isNavigating]);

  return null;
}

export default function StationMap({ station, userLocation, onClose }: StationMapProps) {
  // Routes state (supporting alternatives)
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [isLoadingRoute, setIsLoadingRoute] = useState(true);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Navigation state
  const [isNavigating, setIsNavigating] = useState(false);
  const [navState, setNavState] = useState<NavigationState>({
    currentStepIndex: 0,
    remainingDistance: 0,
    remainingTime: 0,
    currentInstruction: 'Calculating route...',
    isOnRoute: true,
    offRouteDistance: 0,
  });

  // Location tracking
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(
    userLocation || null
  );
  const locationWatchId = useRef<number | null>(null);
  const routeCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Voice turn-by-turn
  const [voiceOn, setVoiceOn] = useState(true);
  const lastSpokenRef = useRef<string>('');

  const speak = useCallback((text: string) => {
    if (!voiceOn || !text) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1;
      u.lang = 'en-IN';
      window.speechSynthesis.speak(u);
    } catch {
      /* ignore speech errors */
    }
  }, [voiceOn]);

  // Open the route in Google Maps (native app turn-by-turn when available)
  const openInGoogleMaps = useCallback(() => {
    const dLat = station.latitude;
    const dLng = station.longitude;
    const o = currentLocation
      ? `&origin=${currentLocation.latitude},${currentLocation.longitude}`
      : '';
    try {
      if (Capacitor.isNativePlatform()) {
        window.open(`google.navigation:q=${dLat},${dLng}&mode=d`, '_system');
        return;
      }
    } catch {
      /* fall through to web */
    }
    window.open(
      `https://www.google.com/maps/dir/?api=1${o}&destination=${dLat},${dLng}&travelmode=driving`,
      '_blank'
    );
  }, [station.latitude, station.longitude, currentLocation]);
  
  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
  }, []);

  // Default user location (Rajahmundry, Andhra Pradesh)
  const defaultUserLocation = { latitude: 17.0000, longitude: 81.7833 };
  const effectiveUserLocation = currentLocation || userLocation || defaultUserLocation;

  const stationPosition: LatLngExpression = [station.latitude, station.longitude];
  const userPosition: LatLngExpression = [effectiveUserLocation.latitude, effectiveUserLocation.longitude];
  const selectedRoute = routes[selectedRouteIndex] || null;

  // Load routes on mount
  useEffect(() => {
    loadRoutes();
    return () => {
      stopLocationTracking();
      if (routeCheckInterval.current) {
        clearInterval(routeCheckInterval.current);
      }
    };
  }, []);

  // Load routes with alternatives
  const loadRoutes = useCallback(async () => {
    setIsLoadingRoute(true);
    setRouteError(null);

    try {
      const cacheKey = `${effectiveUserLocation.latitude},${effectiveUserLocation.longitude}_${station.latitude},${station.longitude}`;
      
      // Always fetch fresh routes to ensure we get proper road-based routing
      // Cache can be unreliable for route geometry
      console.log('Loading routes for:', {
        from: { lat: effectiveUserLocation.latitude, lng: effectiveUserLocation.longitude },
        to: { lat: station.latitude, lng: station.longitude },
      });
      
      // Fetch new routes with alternatives
      const fetchedRoutes = await getRoute(
        effectiveUserLocation.latitude,
        effectiveUserLocation.longitude,
        station.latitude,
        station.longitude,
        { alternatives: 2 }
      );
      
      console.log('Fetched routes:', fetchedRoutes.length);
      
      // Validate routes have proper polylines (more than 2 points = not straight line)
      const validRoutes = fetchedRoutes.filter(route => {
        const isValid = route.polyline && route.polyline.length > 2;
        if (!isValid) {
          console.warn('Route has invalid polyline (straight line):', route);
        }
        return isValid;
      });
      
      if (validRoutes.length === 0) {
        throw new Error('No valid routes found. Please check your locations.');
      }
      
      // Cache the first valid route
      if (validRoutes.length > 0) {
        cacheRoute(cacheKey, validRoutes[0]);
      }

      setRoutes(validRoutes);
      setSelectedRouteIndex(0);
      
      console.log('Routes set:', validRoutes.length, 'valid route(s)');

      // Initialize navigation state with first route
      if (fetchedRoutes.length > 0) {
        const route = fetchedRoutes[0];
        const remaining = calculateRemainingRoute(
          effectiveUserLocation.latitude,
          effectiveUserLocation.longitude,
          route
        );

        setNavState({
          currentStepIndex: remaining.currentStepIndex,
          remainingDistance: remaining.remainingDistance,
          remainingTime: remaining.remainingTime,
          currentInstruction: route.steps[remaining.currentStepIndex]?.instruction || 'Head towards destination',
          isOnRoute: true,
          offRouteDistance: 0,
        });
      }
    } catch (error: any) {
      console.error('Error loading routes:', error);
      setRouteError(error.message || 'Failed to load routes');
    } finally {
      setIsLoadingRoute(false);
    }
  }, [effectiveUserLocation.latitude, effectiveUserLocation.longitude, station.latitude, station.longitude]);

  // Update navigation state when route changes
  useEffect(() => {
    if (selectedRoute && !isNavigating) {
      const remaining = calculateRemainingRoute(
        effectiveUserLocation.latitude,
        effectiveUserLocation.longitude,
        selectedRoute
      );

      setNavState({
        currentStepIndex: remaining.currentStepIndex,
        remainingDistance: remaining.remainingDistance,
        remainingTime: remaining.remainingTime,
        currentInstruction: selectedRoute.steps[remaining.currentStepIndex]?.instruction || 'Head towards destination',
        isOnRoute: true,
        offRouteDistance: 0,
      });
    }
  }, [selectedRouteIndex, selectedRoute, effectiveUserLocation.latitude, effectiveUserLocation.longitude, isNavigating]);

  // Start location tracking
  const startLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 1000,
    };

    locationWatchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCurrentLocation(newLocation);

        if (isNavigating && selectedRoute) {
          updateNavigationState(newLocation);
        }
      },
      (error) => {
        console.error('Location tracking error:', error);
      },
      options
    );
  }, [isNavigating, selectedRoute]);

  // Stop location tracking
  const stopLocationTracking = useCallback(() => {
    if (locationWatchId.current !== null) {
      navigator.geolocation.clearWatch(locationWatchId.current);
      locationWatchId.current = null;
    }
  }, []);

  // Update navigation state
  const updateNavigationState = useCallback(
    (location: { latitude: number; longitude: number }) => {
      if (!selectedRoute) return;

      const onRoute = isOnRoute(location.latitude, location.longitude, selectedRoute.polyline, 50);
      const { distance: offRouteDist } = findNearestPointOnRoute(
        location.latitude,
        location.longitude,
        selectedRoute.polyline
      );

      const remaining = calculateRemainingRoute(location.latitude, location.longitude, selectedRoute);

      setNavState({
        currentStepIndex: remaining.currentStepIndex,
        remainingDistance: remaining.remainingDistance,
        remainingTime: remaining.remainingTime,
        currentInstruction: selectedRoute.steps[remaining.currentStepIndex]?.instruction || 'Head towards destination',
        isOnRoute: onRoute,
        offRouteDistance: offRouteDist,
      });

      if (!onRoute && offRouteDist > 100) {
        console.log('User is off route, considering rerouting...');
      }
    },
    [selectedRoute]
  );

  // Start navigation
  const startNavigation = useCallback(() => {
    setIsNavigating(true);
    startLocationTracking();
    // Announce the first instruction immediately
    const first = selectedRoute?.steps?.[0]?.instruction || 'Starting navigation';
    lastSpokenRef.current = first;
    speak(first);

    routeCheckInterval.current = setInterval(() => {
      if (currentLocation && selectedRoute) {
        updateNavigationState(currentLocation);
      }
    }, 5000);
  }, [currentLocation, selectedRoute, startLocationTracking, updateNavigationState, speak]);

  // Stop navigation
  const stopNavigation = useCallback(() => {
    setIsNavigating(false);
    stopLocationTracking();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (routeCheckInterval.current) {
      clearInterval(routeCheckInterval.current);
      routeCheckInterval.current = null;
    }
  }, [stopLocationTracking]);

  // Speak each new turn instruction as it changes during navigation
  useEffect(() => {
    if (!isNavigating) return;
    const instr = navState.currentInstruction;
    if (instr && instr !== lastSpokenRef.current && instr !== 'Calculating route...') {
      lastSpokenRef.current = instr;
      speak(instr);
    }
  }, [isNavigating, navState.currentStepIndex, navState.currentInstruction, speak]);

  // Re-center map
  const recenterMap = useCallback(() => {
    if (currentLocation && mapRef.current) {
      mapRef.current.setView([currentLocation.latitude, currentLocation.longitude], 16, {
        animate: true,
        duration: 0.5,
      });
    }
  }, [currentLocation]);

  // Reroute
  const handleReroute = useCallback(async () => {
    if (currentLocation) {
      setCurrentLocation(currentLocation);
      await loadRoutes();
    }
  }, [currentLocation, loadRoutes]);

  // Get midpoint of route for info bubble
  const getRouteMidpoint = (polyline: [number, number][]): [number, number] => {
    if (polyline.length === 0) return [0, 0];
    const midIndex = Math.floor(polyline.length / 2);
    return polyline[midIndex];
  };

  return createPortal(
    <div className="station-map-overlay">
      <div className="station-map-container">
        {/* Header */}
        <div className="map-header">
          <div className="map-header-content">
            <div className="map-station-info">
              <h2 className="map-station-name">{station.name}</h2>
              <p className="map-station-address">{station.address}</p>
            </div>
            <button className="map-close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Map */}
        <div className="map-wrapper">
          {isLoadingRoute && (
            <div className="map-loading">
              <div className="map-spinner"></div>
              <p>Calculating routes...</p>
            </div>
          )}

          {routeError && (
            <div className="map-error">
              <AlertCircle size={24} />
              <p>{routeError}</p>
              <button onClick={loadRoutes} className="retry-btn">
                Retry
              </button>
            </div>
          )}

          <MapContainer
            center={stationPosition}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={!isNavigating}
            zoomControl={!isNavigating}
          >
            {/* Google Maps roadmap tiles (lyrs=m) — matches the reference app layer */}
            <TileLayer
              attribution='&copy; Google Maps'
              url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
              subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
              maxZoom={20}
            />

            {/* Start location marker (red pin) */}
            <Marker position={userPosition} icon={startIcon}>
              <Popup>
                <div style={{ padding: '0.5rem', fontFamily: 'system-ui' }}>
                  <div style={{ fontWeight: 600, color: '#EA4335', marginBottom: '0.25rem' }}>
                    Your Location
                  </div>
                </div>
              </Popup>
            </Marker>

            {/* Destination marker (black circle like Google Maps) */}
            <CircleMarker
              center={stationPosition}
              radius={8}
              pathOptions={{
                color: '#000000',
                fillColor: '#000000',
                fillOpacity: 1,
                weight: 2,
              }}
            >
              <CircleMarker
                center={stationPosition}
                radius={4}
                pathOptions={{
                  color: '#FFFFFF',
                  fillColor: '#FFFFFF',
                  fillOpacity: 1,
                  weight: 0,
                }}
              />
              <Popup>
                <div style={{ padding: '0.5rem', fontFamily: 'system-ui' }}>
                  <div style={{ fontWeight: 600, color: '#14532D', marginBottom: '0.25rem' }}>
                    {station.name}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>{station.address}</div>
                </div>
              </Popup>
            </CircleMarker>

            {/* Route polylines (primary + alternatives) */}
            {routes.map((route, index) => {
              const isSelected = index === selectedRouteIndex;
              const isPrimary = index === 0;
              
              return (
                <div key={index}>
                  <Polyline
                    positions={route.polyline}
                    pathOptions={{
                      color: isSelected ? '#4285F4' : isPrimary ? '#4285F4' : '#9AA0A6',
                      weight: isSelected ? 6 : isPrimary ? 5 : 4,
                      opacity: isSelected ? 0.9 : isPrimary ? 0.7 : 0.5,
                      lineJoin: 'round',
                      lineCap: 'round',
                    }}
                    eventHandlers={{
                      click: () => {
                        setSelectedRouteIndex(index);
                      },
                    }}
                  />
                  {/* Route info bubble */}
                  {route.polyline.length > 0 && (
                    <RouteInfoBubble
                      route={route}
                      position={getRouteMidpoint(route.polyline)}
                    />
                  )}
                </div>
              );
            })}

            {/* Map controller */}
            <MapController
              userPos={userPosition}
              stationPos={stationPosition}
              routePolylines={routes.map(r => r.polyline)}
              isNavigating={isNavigating}
              onMapReady={handleMapReady}
            />
          </MapContainer>

          {/* Re-center button */}
          {isNavigating && (
            <button className="recenter-btn" onClick={recenterMap} title="Re-center map">
              <Navigation size={20} />
            </button>
          )}

          {/* Off-route indicator */}
          {isNavigating && !navState.isOnRoute && navState.offRouteDistance > 50 && (
            <div className="off-route-alert">
              <AlertCircle size={20} />
              <span>You're off route</span>
              <button onClick={handleReroute} className="reroute-btn">
                Reroute
              </button>
            </div>
          )}
        </div>

        {/* Route Selection Panel (when multiple routes available) */}
        {!isNavigating && routes.length > 1 && (
          <div className="route-selection-panel">
            <div className="route-selection-title">Choose a route</div>
            <div className="route-options">
              {routes.map((route, index) => (
                <button
                  key={index}
                  className={`route-option ${index === selectedRouteIndex ? 'selected' : ''}`}
                  onClick={() => setSelectedRouteIndex(index)}
                >
                  <div className="route-option-content">
                    <div className="route-option-time">{formatTime(route.duration)}</div>
                    <div className="route-option-distance">{formatDistance(route.distance)}</div>
                  </div>
                  {index === selectedRouteIndex && (
                    <div className="route-option-check">
                      <CheckCircle size={20} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Route Info Card / Navigation Panel */}
        {!isNavigating ? (
          <div className="route-info-card">
            <div className="route-info-item">
              <div className="route-icon">
                <Route size={20} />
              </div>
              <div className="route-details">
                <span className="route-label">Distance</span>
                <span className="route-value">
                  {selectedRoute ? formatDistance(selectedRoute.distance) : 'Calculating...'}
                </span>
              </div>
            </div>
            <div className="route-info-item">
              <div className="route-icon">
                <Clock size={20} />
              </div>
              <div className="route-details">
                <span className="route-label">Est. Time</span>
                <span className="route-value">
                  {selectedRoute ? formatTime(selectedRoute.duration) : 'Calculating...'}
                </span>
              </div>
            </div>
            <button
              className="navigate-btn"
              onClick={startNavigation}
              disabled={!selectedRoute || isLoadingRoute}
            >
              <Play size={18} />
              <span>Start Navigation</span>
            </button>
            <button className="gmaps-btn" onClick={openInGoogleMaps}>
              <ExternalLink size={16} />
              <span>Open in Google Maps</span>
            </button>
          </div>
        ) : (
          <div className="navigation-panel">
            {/* Current instruction */}
            <div className="nav-instruction">
              <div className="nav-instruction-icon">
                <Navigation size={24} />
              </div>
              <div className="nav-instruction-text">
                <span className="nav-instruction-main">{navState.currentInstruction}</span>
                {navState.remainingDistance > 0 && (
                  <span className="nav-instruction-distance">
                    in {formatDistance(navState.remainingDistance)}
                  </span>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="nav-stats">
              <div className="nav-stat-item">
                <div className="nav-stat-icon">
                  <Route size={18} />
                </div>
                <div className="nav-stat-content">
                  <span className="nav-stat-label">Remaining</span>
                  <span className="nav-stat-value">{formatDistance(navState.remainingDistance)}</span>
                </div>
              </div>
              <div className="nav-stat-item">
                <div className="nav-stat-icon">
                  <Clock size={18} />
                </div>
                <div className="nav-stat-content">
                  <span className="nav-stat-label">ETA</span>
                  <span className="nav-stat-value">{formatTime(navState.remainingTime)}</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="nav-actions">
              <button className="nav-action-btn secondary" onClick={stopNavigation}>
                <Square size={18} />
                <span>Stop</span>
              </button>
              <button className="nav-action-btn secondary" onClick={handleReroute}>
                <RotateCcw size={18} />
                <span>Reroute</span>
              </button>
              <button
                className={`nav-action-btn secondary ${voiceOn ? 'voice-on' : ''}`}
                onClick={() => {
                  if (voiceOn && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                  }
                  setVoiceOn((v) => !v);
                }}
                title={voiceOn ? 'Mute voice' : 'Unmute voice'}
              >
                {voiceOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
                <span>{voiceOn ? 'Voice' : 'Muted'}</span>
              </button>
              <button className="nav-action-btn secondary" onClick={openInGoogleMaps} title="Open in Google Maps">
                <ExternalLink size={18} />
                <span>Maps</span>
              </button>
            </div>
          </div>
        )}

        {/* Navigation Status Bar */}
        {isNavigating && (
          <div className="navigation-status">
            <div className="nav-status-content">
              <div className="nav-status-icon">
                <Navigation size={24} />
              </div>
              <div className="nav-status-text">
                <span className="nav-status-label">Navigating to</span>
                <span className="nav-status-destination">{station.name}</span>
              </div>
              {navState.isOnRoute && (
                <div className="nav-status-indicator">
                  <CheckCircle size={20} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
