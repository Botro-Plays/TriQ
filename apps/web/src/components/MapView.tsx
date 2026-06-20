import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default icon paths for bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  icon?: 'default' | 'pickup' | 'dropoff' | 'driver';
}

interface MapViewProps {
  center: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
  fitBounds?: boolean;
}

const iconColors: Record<string, string> = {
  pickup: '#22c55e',
  dropoff: '#ef4444',
  driver: '#3b82f6',
  default: '#eab308',
};

function createDivIcon(color: string, label?: string) {
  const html = label
    ? `<div style="background:${color};width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);color:white;font-size:10px;font-weight:bold;">${label}</span></div>`
    : `<div style="background:${color};width:20px;height:20px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`;
  return L.divIcon({ html, className: 'triq-marker', iconSize: [28, 28], iconAnchor: [14, 28] });
}

export default function MapView({
  center,
  zoom = 14,
  markers = [],
  onMapClick,
  className = '',
  fitBounds = false,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(center, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    if (onMapClick) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Update center
    map.setView(center, zoom);

    // Clear old markers
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    // Add new markers
    markers.forEach((m) => {
      const color = iconColors[m.icon || 'default'] || iconColors.default;
      const marker = L.marker([m.lat, m.lng], { icon: createDivIcon(color, m.label) }).addTo(map);
      markersRef.current[m.id] = marker;
    });

    // Fit bounds if requested and multiple markers
    if (fitBounds && markers.length > 1) {
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [center, zoom, markers, fitBounds]);

  return <div ref={containerRef} className={`w-full h-full rounded-xl ${className}`} style={{ minHeight: '300px' }} />;
}
