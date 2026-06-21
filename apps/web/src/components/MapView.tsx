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
  icon?: 'default' | 'pickup' | 'dropoff' | 'driver' | 'tricycle' | 'passenger';
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
  tricycle: '#f59e0b',
  passenger: '#3b82f6',
};

const tricycleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M7 17h10"/><path d="M7 17l3-6h7l3 6"/><path d="M10 11l1-4h3"/></svg>`;

const personSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="0"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0z"/></svg>`;

function createDivIcon(color: string, label?: string, iconType?: string) {
  let innerHtml: string;
  if (iconType === 'tricycle') {
    innerHtml = `<div style="background:${color};width:32px;height:32px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">${tricycleSvg}</div>`;
    return L.divIcon({ html: innerHtml, className: 'triq-marker', iconSize: [32, 32], iconAnchor: [16, 16] });
  } else if (iconType === 'passenger') {
    innerHtml = `<div style="background:${color};width:28px;height:28px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">${personSvg}</div>`;
    return L.divIcon({ html: innerHtml, className: 'triq-marker', iconSize: [28, 28], iconAnchor: [14, 14] });
  }
  innerHtml = label
    ? `<div style="background:${color};width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);color:white;font-size:10px;font-weight:bold;">${label}</span></div>`
    : `<div style="background:${color};width:20px;height:20px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`;
  return L.divIcon({ html: innerHtml, className: 'triq-marker', iconSize: [28, 28], iconAnchor: [14, 28] });
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
  const onMapClickRef = useRef(onMapClick);

  // Keep ref updated so the map always calls the latest callback
  onMapClickRef.current = onMapClick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(center, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    // Use ref to always call the latest onMapClick
    map.on('click', (e: L.LeafletMouseEvent) => {
      onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
    });

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
      const iconType = m.icon || 'default';
      const color = iconColors[iconType] || iconColors.default;
      const marker = L.marker([m.lat, m.lng], { icon: createDivIcon(color, m.label, iconType) }).addTo(map);
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
