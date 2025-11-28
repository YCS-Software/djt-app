import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import { Icon, LatLngExpression } from 'leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import { MapPin, Navigation, X, Clock, Route, Play, Square, ArrowRight, Navigation2 } from 'lucide-react';
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

// Component to draw route polyline directly - This ensures route is ALWAYS visible
function RoutePolyline({ 
  userPos, 
  stationPos,
  routeCoordinates 
}: { 
  userPos: LatLngExpression; 
  stationPos: LatLngExpression;
  routeCoordinates?: [number, number][] | null;
}) {
  const userLatLng = Array.isArray(userPos) 
    ? [userPos[0], userPos[1]]
    : [(userPos as any).lat, (userPos as any).lng];
  const stationLatLng = Array.isArray(stationPos)
    ? [stationPos[0], stationPos[1]]
    : [(stationPos as any).lat, (stationPos as any).lng];

  // Use route coordinates if available and valid, otherwise use direct line
  const positions = routeCoordinates && routeCoordinates.length > 1
    ? routeCoordinates
    : [userLatLng, stationLatLng];

  // Always render the route line - this ensures it's visible
  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color: '#16A34A',
        weight: 8,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }}
    />
  );
}

// Component to handle routing
function RoutingControl({ 
  userPos, 
  stationPos, 
  onRouteFound,
  isNavigating = false,
  onRouteUpdate,
  onRouteCoordinates
}: { 
  userPos: LatLngExpression; 
  stationPos: LatLngExpression;
  onRouteFound: (distance: string, time: string, instructions?: any[]) => void;
  isNavigating?: boolean;
  onRouteUpdate?: (distance: string, time: string) => void;
  onRouteCoordinates?: (coordinates: [number, number][]) => void;
}) {
  const map = useMap();
  const routingControlRef = useRef<any>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const watchIdRef = useRef<number | null>(null);

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
      routingControlRef.current = null;
    }

    // Remove existing route layer
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    // Create a layer group for the route
    const routeLayer = L.layerGroup().addTo(map);
    routeLayerRef.current = routeLayer;

    // Set initial coordinates for React component (direct line as fallback)
    // This ensures route is visible immediately
    if (onRouteCoordinates) {
      onRouteCoordinates([[userLatLng.lat, userLatLng.lng], [stationLatLng.lat, stationLatLng.lng]]);
    }

    // Timeout fallback - if route doesn't load in 10 seconds, use fallback
    const timeoutId = setTimeout(() => {
      const R = 6371;
      const dLat = (stationLatLng.lat - userLatLng.lat) * Math.PI / 180;
      const dLon = (stationLatLng.lng - userLatLng.lng) * Math.PI / 180;
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(userLatLng.lat * Math.PI / 180) * Math.cos(stationLatLng.lat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = (R * c).toFixed(1);
      const time = Math.round((R * c / 30) * 60);
      const timeStr = time < 60 ? `${time} min` : `${Math.floor(time / 60)}h ${time % 60}m`;
      onRouteFound(`${distance} km`, timeStr);
    }, 10000);

    // Fetch route geometry directly from OSRM API
    const fetchRouteGeometry = async () => {
      try {
        const url = `https://router.projectosrm.org/route/v1/driving/${userLatLng.lng},${userLatLng.lat};${stationLatLng.lng},${stationLatLng.lat}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const geometry = route.geometry;
          
          // Decode GeoJSON coordinates (they're in [lng, lat] format, need to convert to [lat, lng])
          const coordinates: [number, number][] = geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]);
          
          if (coordinates.length > 0 && onRouteCoordinates) {
            // Update the React component with actual route coordinates
            onRouteCoordinates(coordinates);
            
            // Calculate distance and time
            const distance = (route.distance / 1000).toFixed(1);
            const time = Math.round(route.duration / 60);
            const timeStr = time < 60 ? `${time} min` : `${Math.floor(time / 60)}h ${time % 60}m`;
            
            onRouteFound(`${distance} km`, timeStr, []);
          }
        }
      } catch (error) {
        console.error('Error fetching route geometry:', error);
        // Keep the direct line as fallback
      }
    };

    // Fetch route immediately
    fetchRouteGeometry();

    // Create routing control with OSRM (as backup)
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
            weight: 7,
            opacity: 0.95,
            dashArray: isNavigating ? '10, 5' : undefined,
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
      clearTimeout(timeoutId); // Clear timeout if route is found
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
        
        // Extract instructions if available
        const instructions = route.instructions || [];
        
        // Extract route coordinates from geometry
        let routeCoords: [number, number][] = [];
        if (route.coordinates && route.coordinates.length > 0) {
          routeCoords = route.coordinates.map((coord: any) => [coord.lat, coord.lng] as [number, number]);
        } else if (route.coordinate) {
          // Alternative format
          routeCoords = route.coordinate.map((coord: any) => [coord.lat, coord.lng] as [number, number]);
        } else if (route.geometry) {
          // Decode polyline if needed
          try {
            const decoded = (L as any).Routing.decodePolyline(route.geometry);
            routeCoords = decoded.map((coord: any) => [coord.lat, coord.lng] as [number, number]);
          } catch (e) {
            console.log('Could not decode geometry, using waypoints');
            routeCoords = [[userLatLng.lat, userLatLng.lng], [stationLatLng.lat, stationLatLng.lng]];
          }
        }
        
          // If we have route coordinates, update the React component
          if (routeCoords.length > 0 && onRouteCoordinates) {
            onRouteCoordinates(routeCoords);
          }
        
        onRouteFound(`${distance} km`, timeStr, instructions);
        
        // Ensure route is visible and styled properly - multiple attempts for reliability
        const styleRoute = () => {
          // Style the route line using multiple selectors
          const selectors = [
            '.leaflet-routing-line',
            '.leaflet-routing-line path',
            '.leaflet-routing-line polyline',
            'path[stroke]',
            '.leaflet-interactive'
          ];
          
          selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach((element: any) => {
              // Check if this is likely a route line (has stroke or is in routing container)
              const parent = element.closest('.leaflet-routing-container, .leaflet-routing-alt');
              if (parent || element.getAttribute('stroke') || element.style.stroke) {
                if (element.style) {
                  element.style.stroke = '#16A34A';
                  element.style.strokeWidth = '7px';
                  element.style.opacity = '0.95';
                  element.style.fill = 'none';
                  element.style.zIndex = '500';
                  element.setAttribute('stroke', '#16A34A');
                  element.setAttribute('stroke-width', '7');
                }
              }
            });
          });
          
          // Add animation class if navigating
          if (isNavigating) {
            const routeLines = document.querySelectorAll('.leaflet-routing-line');
            routeLines.forEach((line: any) => {
              line.classList.add('leaflet-routing-line-navigating');
            });
          }
        };
        
        // Try styling immediately and with delays
        styleRoute();
        setTimeout(styleRoute, 200);
        setTimeout(styleRoute, 500);
        setTimeout(styleRoute, 1000);
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

    // Fit bounds to show both points (only if not navigating)
    if (!isNavigating) {
      const bounds = L.latLngBounds([userLatLng, stationLatLng]);
      map.fitBounds(bounds, { padding: [80, 80] });
    }

    return () => {
      clearTimeout(timeoutId);
      if (routingControlRef.current) {
        map.removeControl(routingControlRef.current);
        routingControlRef.current = null;
      }
      if (routeLayerRef.current) {
        map.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }
    };
  }, [map, userPos, stationPos, onRouteFound, isNavigating, onRouteCoordinates]);

  // Real-time navigation tracking - FIXED: Prevent multiple watchers and excessive API calls
  useEffect(() => {
    if (!isNavigating || !map || !onRouteUpdate) {
      // Clean up watcher when not navigating
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    // Prevent multiple watchers - clear existing one first
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    let lastUpdateTime = 0;
    let lastPosition: L.LatLng | null = null;
    let initialZoomSet = false;
    const throttleDelay = 3000; // Increased to 3 seconds to reduce API calls
    const minDistanceForUpdate = 0.0005; // Increased to ~50 meters to reduce updates
    let updateTimeout: NodeJS.Timeout | null = null;

    const updateRoute = () => {
      if (!navigator.geolocation || watchIdRef.current !== null) return; // Prevent duplicate watchers

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const currentPos = L.latLng(position.coords.latitude, position.coords.longitude);
          const stationLatLng = Array.isArray(stationPos)
            ? L.latLng(stationPos[0], stationPos[1])
            : L.latLng((stationPos as any).lat, (stationPos as any).lng);
          
          // Calculate remaining distance (no API call, just calculation)
          const R = 6371; // Earth radius in km
          const dLat = (stationLatLng.lat - currentPos.lat) * Math.PI / 180;
          const dLon = (stationLatLng.lng - currentPos.lng) * Math.PI / 180;
          const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(currentPos.lat * Math.PI / 180) * Math.cos(stationLatLng.lat * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = (R * c).toFixed(1);
          
          // Estimate time based on average speed (assuming 40 km/h in city)
          const time = Math.round((R * c / 40) * 60);
          const timeStr = time < 60 ? `${time} min` : `${Math.floor(time / 60)}h ${time % 60}m`;
          
          onRouteUpdate(`${distance} km`, timeStr);
          
          // Throttle map view updates to prevent blinking - use timeout debounce
          const now = Date.now();
          const timeSinceLastUpdate = now - lastUpdateTime;
          
          // Check if position has changed significantly
          const positionChanged = !lastPosition || 
            currentPos.distanceTo(lastPosition) > minDistanceForUpdate;
          
          // Clear existing timeout
          if (updateTimeout) {
            clearTimeout(updateTimeout);
          }
          
          // Debounce map updates
          if (positionChanged && timeSinceLastUpdate >= throttleDelay) {
            updateTimeout = setTimeout(() => {
              lastUpdateTime = Date.now();
              lastPosition = currentPos;
              
              // Set initial zoom only once when navigation starts
              if (!initialZoomSet) {
                const currentZoom = map.getZoom();
                const targetZoom = currentZoom < 15 ? 15 : currentZoom;
                map.setView(currentPos, targetZoom, { 
                  animate: true, 
                  duration: 1.0,
                  easeLinearity: 0.25
                });
                initialZoomSet = true;
              } else {
                // Use panTo for smoother updates without zoom changes
                map.panTo(currentPos, {
                  animate: true,
                  duration: 0.8,
                  easeLinearity: 0.25
                });
              }
            }, 500); // Additional 500ms debounce
          }
        },
        (error) => {
          console.error('Error tracking position:', error);
        },
        {
          enableHighAccuracy: false, // Changed to false to reduce battery usage
          timeout: 10000, // Increased timeout
          maximumAge: 5000 // Allow older positions to reduce updates
        }
      );
    };

    // Small delay before starting watcher to prevent immediate multiple calls
    const startTimeout = setTimeout(() => {
      updateRoute();
    }, 500);

    return () => {
      clearTimeout(startTimeout);
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      lastPosition = null;
      initialZoomSet = false;
    };
  }, [isNavigating, map, stationPos, onRouteUpdate]);

  return null;
}

// Component to fit map bounds
function MapBounds({ userPos, stationPos, isNavigating }: { userPos: LatLngExpression; stationPos: LatLngExpression; isNavigating?: boolean }) {
  const map = useMap();
  
  useEffect(() => {
    // Don't fit bounds when navigating - let navigation tracking handle the view
    if (isNavigating) return;
    
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
  }, [map, userPos, stationPos, isNavigating]);
  
  return null;
}

export default function StationMap({ station, userLocation, onClose }: StationMapProps) {
  const [estimatedTime, setEstimatedTime] = useState<string>('Calculating...');
  const [estimatedDistance, setEstimatedDistance] = useState<string>('Calculating...');
  const [isNavigating, setIsNavigating] = useState(false);
  const [routeInstructions, setRouteInstructions] = useState<any[]>([]);
  const [currentInstruction, setCurrentInstruction] = useState<string>('');
  const [currentLocation, setCurrentLocation] = useState<LatLngExpression | null>(null);
  const [remainingDistance, setRemainingDistance] = useState<string>('');
  const [remainingTime, setRemainingTime] = useState<string>('');
  const [routeLoading, setRouteLoading] = useState<boolean>(true);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][] | null>(null);

  // Default user location (Rajahmundry, Andhra Pradesh, India)
  const defaultUserLocation: LatLngExpression = [17.0000, 81.7833];
  const currentUserLocation: LatLngExpression = currentLocation || (userLocation 
    ? [userLocation.latitude, userLocation.longitude]
    : defaultUserLocation);
  
  const stationPosition: LatLngExpression = [station.latitude, station.longitude];

  const processInstruction = useCallback((instruction: any): string => {
    if (!instruction) return 'Follow the route';
    
    // Clean up instruction text
    let text = instruction.text || '';
    
    // Remove HTML tags if present
    text = text.replace(/<[^>]*>/g, '');
    
    // Make instructions more meaningful
    if (text.toLowerCase().includes('head') || text.toLowerCase().includes('go')) {
      return text;
    } else if (text.toLowerCase().includes('turn left')) {
      return `Turn left${instruction.road ? ` onto ${instruction.road}` : ''}`;
    } else if (text.toLowerCase().includes('turn right')) {
      return `Turn right${instruction.road ? ` onto ${instruction.road}` : ''}`;
    } else if (text.toLowerCase().includes('continue') || text.toLowerCase().includes('straight')) {
      return `Continue straight${instruction.road ? ` on ${instruction.road}` : ''}`;
    } else if (text.toLowerCase().includes('destination')) {
      return `You have arrived at ${station.name}`;
    }
    
    return text || 'Follow the route';
  }, [station.name]);

  const handleRouteFound = useCallback((distance: string, time: string, instructions?: any[]) => {
    setRouteLoading(false);
    setEstimatedDistance(distance);
    setEstimatedTime(time);
    if (instructions && instructions.length > 0) {
      setRouteInstructions(instructions);
      const firstInstruction = processInstruction(instructions[0]);
      setCurrentInstruction(firstInstruction);
    } else {
      setCurrentInstruction(`Navigate to ${station.name}`);
    }
  }, [processInstruction, station.name]);

  const handleRouteUpdate = useCallback((distance: string, time: string) => {
    setRemainingDistance(distance);
    setRemainingTime(time);
  }, []);

  const handleRouteCoordinates = useCallback((coordinates: [number, number][]) => {
    setRouteCoordinates(coordinates);
  }, []);

  // Update instructions during navigation
  useEffect(() => {
    if (isNavigating && routeInstructions.length > 0 && currentLocation) {
      // Find the closest instruction based on current location
      // For now, show the first meaningful instruction
      // In a real app, you'd calculate which instruction is closest
      const activeInstruction = routeInstructions.find((inst, index) => {
        // Simple logic: show first instruction, then progress through them
        return index === 0 || (index < routeInstructions.length / 2);
      });
      
      if (activeInstruction) {
        const processed = processInstruction(activeInstruction);
        setCurrentInstruction(processed);
      }
    }
  }, [isNavigating, routeInstructions, currentLocation, processInstruction]);

  const startNavigation = useCallback(() => {
    // Prevent multiple clicks - disable button during transition
    if (isNavigating) return;
    
    if (!estimatedDistance || estimatedDistance === 'Calculating...') {
      alert('Please wait for the route to be calculated');
      return;
    }
    
    setIsNavigating(true);
    setRemainingDistance(estimatedDistance);
    setRemainingTime(estimatedTime);
    
    // Get current location for navigation (only once)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation: LatLngExpression = [position.coords.latitude, position.coords.longitude];
          setCurrentLocation(newLocation);
        },
        (error) => {
          console.error('Error getting location:', error);
          // Use existing user location
          if (userLocation) {
            setCurrentLocation([userLocation.latitude, userLocation.longitude]);
          }
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 5000 }
      );
    } else if (userLocation) {
      setCurrentLocation([userLocation.latitude, userLocation.longitude]);
    }
  }, [isNavigating, estimatedDistance, estimatedTime, userLocation]);

  const stopNavigation = useCallback(() => {
    setIsNavigating(false);
    setRemainingDistance('');
    setRemainingTime('');
    setCurrentInstruction('');
  }, []);

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
          {routeLoading && (
            <div className="map-loading">
              <div className="map-spinner"></div>
              <p>Calculating route...</p>
            </div>
          )}
          <MapContainer
            center={stationPosition}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={!isNavigating}
            zoomControl={true}
            dragging={true}
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
              isNavigating={isNavigating}
              onRouteUpdate={handleRouteUpdate}
              onRouteCoordinates={handleRouteCoordinates}
            />

            {/* Direct Route Polyline - Fallback/Actual Route */}
            <RoutePolyline 
              userPos={currentUserLocation} 
              stationPos={stationPosition}
              routeCoordinates={routeCoordinates || undefined}
            />

            {/* Fit bounds - disabled during navigation */}
            <MapBounds userPos={currentUserLocation} stationPos={stationPosition} isNavigating={isNavigating} />
          </MapContainer>
        </div>

        {/* Route Info Card - Google Maps Style */}
        {!isNavigating ? (
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
            <button 
              className="navigate-btn" 
              onClick={startNavigation}
              disabled={routeLoading || estimatedDistance === 'Calculating...'}
            >
              <Navigation2 size={18} />
              <span>Start</span>
            </button>
          </div>
        ) : (
          <div className="navigation-card">
            <div className="nav-card-header">
              <div className="nav-card-info">
                <div className="nav-card-distance">{remainingDistance || estimatedDistance}</div>
                <div className="nav-card-time">{remainingTime || estimatedTime}</div>
              </div>
              <button className="nav-stop-btn" onClick={stopNavigation}>
                <Square size={18} />
              </button>
            </div>
            {currentInstruction && (
              <div className="nav-card-instruction">
                <ArrowRight size={16} />
                <span>{currentInstruction}</span>
              </div>
            )}
            <div className="nav-card-destination">
              <MapPin size={14} />
              <span>{station.name}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
