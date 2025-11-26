import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon, LatLngExpression } from 'leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import { MapPin, Navigation, X, Clock, Route, Play, Square } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './StationMap.css';

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

// Custom icon for user location
const userIcon = new Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#2563EB" stroke="white" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="4" fill="white"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

// Custom icon for station
const stationIcon = new Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#16A34A" stroke="white" stroke-width="2">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  `),
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

// Component to handle routing
function RoutingControl({ 
  userPos, 
  stationPos, 
  onRouteFound 
}: { 
  userPos: LatLngExpression; 
  stationPos: LatLngExpression;
  onRouteFound: (distance: string, time: string) => void;
}) {
  const map = useMap();
  const routingControlRef = useRef<any>(null);

  useEffect(() => {
    if (!map) return;

    const userLatLng = Array.isArray(userPos) 
      ? L.latLng(userPos[0], userPos[1])
      : L.latLng((userPos as any).lat, (userPos as any).lng);
    const stationLatLng = Array.isArray(stationPos)
      ? L.latLng(stationPos[0], stationPos[1])
      : L.latLng((stationPos as any).lat, (stationPos as any).lng);

    // Remove existing routing control
    if (routingControlRef.current) {
      map.removeControl(routingControlRef.current);
    }

    // Create routing control with OSRM
    const routingControl = (L as any).Routing.control({
      waypoints: [userLatLng, stationLatLng],
      router: (L as any).Routing.osrmv1({
        serviceUrl: 'https://router.projectosrm.org/route/v1',
        profile: 'driving',
      }),
      routeWhileDragging: false,
      showAlternatives: false,
      lineOptions: {
        styles: [
          {
            color: '#16A34A',
            weight: 6,
            opacity: 0.9,
          }
        ],
        extendToWaypoints: true,
        missingRouteTolerance: 0,
      },
      createMarker: function() {
        return null; // Don't create default markers, we use custom ones
      },
      addWaypoints: false,
      fitSelectedRoutes: 'smart',
      show: false, // Hide the instructions panel
      collapsible: false,
    }).addTo(map);

    // Hide the routing container after it's added
    setTimeout(() => {
      const routingContainer = document.querySelector('.leaflet-routing-container');
      if (routingContainer) {
        (routingContainer as HTMLElement).style.display = 'none';
      }
    }, 100);

    routingControlRef.current = routingControl;

    // Listen for route found event
    routingControl.on('routesfound', function(e: any) {
      const routes = e.routes;
      if (routes && routes.length > 0) {
        const route = routes[0];
        const distance = (route.summary.totalDistance / 1000).toFixed(1); // Convert to km
        const time = Math.round(route.summary.totalTime / 60); // Convert to minutes
        
        let timeStr = '';
        if (time < 60) {
          timeStr = `${time} min`;
        } else {
          const hours = Math.floor(time / 60);
          const mins = time % 60;
          timeStr = `${hours}h ${mins}m`;
        }
        
        onRouteFound(`${distance} km`, timeStr);
      }
    });

    // Handle routing errors
    routingControl.on('routingerror', function(e: any) {
      console.error('Routing error:', e);
      // Calculate fallback distance using Haversine formula
      const R = 6371; // Earth radius in km
      const dLat = (stationLatLng.lat - userLatLng.lat) * Math.PI / 180;
      const dLon = (stationLatLng.lng - userLatLng.lng) * Math.PI / 180;
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(userLatLng.lat * Math.PI / 180) * Math.cos(stationLatLng.lat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = (R * c).toFixed(1);
      const time = Math.round((R * c / 30) * 60); // Assuming 30 km/h average
      const timeStr = time < 60 ? `${time} min` : `${Math.floor(time / 60)}h ${time % 60}m`;
      onRouteFound(`${distance} km`, timeStr);
    });

    // Fit bounds to show both points
    const bounds = L.latLngBounds([userLatLng, stationLatLng]);
    map.fitBounds(bounds, { padding: [80, 80] });

    return () => {
      if (routingControlRef.current) {
        map.removeControl(routingControlRef.current);
      }
    };
  }, [map, userPos, stationPos, onRouteFound]);

  return null;
}

// Component to fit map bounds
function MapBounds({ userPos, stationPos }: { userPos: LatLngExpression; stationPos: LatLngExpression }) {
  const map = useMap();
  
  useEffect(() => {
    if (userPos && stationPos) {
      try {
        const userLatLng = Array.isArray(userPos) 
          ? L.latLng(userPos[0], userPos[1])
          : L.latLng((userPos as any).lat, (userPos as any).lng);
        const stationLatLng = Array.isArray(stationPos)
          ? L.latLng(stationPos[0], stationPos[1])
          : L.latLng((stationPos as any).lat, (stationPos as any).lng);
        
        const bounds = L.latLngBounds([userLatLng, stationLatLng]);
        map.fitBounds(bounds, { padding: [80, 80] });
      } catch (error) {
        console.error('Error fitting bounds:', error);
      }
    }
  }, [map, userPos, stationPos]);
  
  return null;
}

export default function StationMap({ station, userLocation, onClose }: StationMapProps) {
  const [estimatedTime, setEstimatedTime] = useState<string>('Calculating...');
  const [estimatedDistance, setEstimatedDistance] = useState<string>('Calculating...');
  const [isNavigating, setIsNavigating] = useState(false);
  const [routeInstructions, setRouteInstructions] = useState<string[]>([]);

  // Default user location (Gurugram, India)
  const defaultUserLocation: LatLngExpression = [28.4595, 77.0266];
  const currentUserLocation: LatLngExpression = userLocation 
    ? [userLocation.latitude, userLocation.longitude]
    : defaultUserLocation;
  
  const stationPosition: LatLngExpression = [station.latitude, station.longitude];

  const handleRouteFound = (distance: string, time: string) => {
    setEstimatedDistance(distance);
    setEstimatedTime(time);
  };

  const startNavigation = () => {
    setIsNavigating(true);
    // In a real app, you would start turn-by-turn navigation here
    // For now, we'll just show that navigation is active
  };

  const stopNavigation = () => {
    setIsNavigating(false);
  };

  return (
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
          <MapContainer
            center={stationPosition}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* User location marker */}
            <Marker position={currentUserLocation} icon={userIcon}>
              <Popup>
                <div style={{ padding: '0.5rem', fontFamily: 'system-ui' }}>
                  <div style={{ fontWeight: 600, color: '#2563EB', marginBottom: '0.25rem' }}>Your Location</div>
                </div>
              </Popup>
            </Marker>

            {/* Station marker */}
            <Marker position={stationPosition} icon={stationIcon}>
              <Popup>
                <div style={{ padding: '0.5rem', fontFamily: 'system-ui' }}>
                  <div style={{ fontWeight: 600, color: '#14532D', marginBottom: '0.25rem' }}>{station.name}</div>
                  <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>{station.address}</div>
                </div>
              </Popup>
            </Marker>

            {/* Routing Control - Shows actual route */}
            <RoutingControl 
              userPos={currentUserLocation} 
              stationPos={stationPosition}
              onRouteFound={handleRouteFound}
            />

            {/* Fit bounds */}
            <MapBounds userPos={currentUserLocation} stationPos={stationPosition} />
          </MapContainer>
        </div>

        {/* Route Info Card */}
        <div className="route-info-card">
          <div className="route-info-item">
            <div className="route-icon">
              <Route size={20} />
            </div>
            <div className="route-details">
              <span className="route-label">Distance</span>
              <span className="route-value">{estimatedDistance}</span>
            </div>
          </div>
          <div className="route-info-item">
            <div className="route-icon">
              <Clock size={20} />
            </div>
            <div className="route-details">
              <span className="route-label">Est. Time</span>
              <span className="route-value">{estimatedTime}</span>
            </div>
          </div>
          {!isNavigating ? (
            <button className="navigate-btn" onClick={startNavigation}>
              <Play size={18} />
              <span>Start Navigation</span>
            </button>
          ) : (
            <button className="navigate-btn stop-nav" onClick={stopNavigation}>
              <Square size={18} />
              <span>Stop</span>
            </button>
          )}
        </div>

        {/* Navigation Status (when active) */}
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
