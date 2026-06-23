import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, MapPin } from 'lucide-react';

interface LocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
  height?: number;
}

// Default center: Rajahmundry, Andhra Pradesh (app's home region)
const DEFAULT_CENTER: [number, number] = [17.0005, 81.7833];

/**
 * Interactive map for an owner to pin a station's exact location.
 * Click anywhere or drag the marker to capture latitude/longitude.
 */
export default function LocationPicker({ latitude, longitude, onChange, height = 280 }: LocationPickerProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // build a crisp cyan pin (avoids the default leaflet icon 404s)
  const pinIcon = L.divIcon({
    className: '',
    html: `<div style="transform:translate(-50%,-100%);filter:drop-shadow(0 4px 6px rgba(0,0,0,.5))">
      <svg width="34" height="44" viewBox="0 0 34 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 0C7.6 0 0 7.6 0 17c0 12 17 27 17 27s17-15 17-27C34 7.6 26.4 0 17 0z" fill="#22D3EE"/>
        <circle cx="17" cy="17" r="6.5" fill="#0B1220"/>
      </svg></div>`,
    iconSize: [34, 44],
    iconAnchor: [17, 44],
  });

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;

    const start: [number, number] =
      latitude != null && longitude != null ? [latitude, longitude] : DEFAULT_CENTER;

    const map = L.map(elRef.current, { zoomControl: true, attributionControl: false }).setView(start, 14);
    // Google Maps roadmap tiles (lyrs=m) — matches the reference app layer
    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }).addTo(map);

    const marker = L.marker(start, { icon: pinIcon, draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      onChangeRef.current(+p.lat.toFixed(6), +p.lng.toFixed(6));
    });
    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onChangeRef.current(+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6));
    });

    mapRef.current = map;
    markerRef.current = marker;

    // map needs a tick to size correctly inside a flex/animated container
    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep marker in sync when value is set externally (e.g. "use my location")
  useEffect(() => {
    if (latitude != null && longitude != null && markerRef.current && mapRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
      mapRef.current.setView([latitude, longitude], Math.max(mapRef.current.getZoom(), 15), { animate: true });
    }
  }, [latitude, longitude]);

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => onChangeRef.current(+pos.coords.latitude.toFixed(6), +pos.coords.longitude.toFixed(6)),
      () => alert('Could not get your location. Please pin it manually on the map.'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  return (
    <div className="loc-picker">
      <div ref={elRef} className="loc-picker-map" style={{ height }} />
      <button type="button" className="loc-picker-locate" onClick={useMyLocation}>
        <Crosshair size={16} /> Use my location
      </button>
      <div className="loc-picker-hint">
        <MapPin size={13} /> Tap the map or drag the pin to set the exact spot
      </div>
    </div>
  );
}
