import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import MapView from '../../components/MapView';
import { getCurrentLocation, type GeoError } from '../../lib/geolocation';
import { Crosshair } from 'lucide-react';

const DIGOS_CENTER: [number, number] = [6.7500, 125.3573];

interface NearbyDriver {
  id: string;
  name: string;
  currentLat: number;
  currentLng: number;
  distance: number;
}

export default function PassengerMap() {
  const [center, setCenter] = useState<[number, number]>(DIGOS_CENTER);
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriver[]>([]);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');

  const useMyLocation = async () => {
    setLocating(true);
    setGeoError('');
    try {
      const pos = await getCurrentLocation();
      setCenter([pos.lat, pos.lng]);
    } catch (err) {
      const geoErr = err as GeoError;
      setGeoError(geoErr.message);
    } finally {
      setLocating(false);
    }
  };

  const fetchNearby = useCallback(async () => {
    try {
      const { data } = await api.get('/drivers/nearby', { params: { lat: center[0], lng: center[1], radius: 5 } });
      setNearbyDrivers(data.drivers);
    } catch {}
  }, [center]);

  useEffect(() => {
    fetchNearby();
    const interval = setInterval(fetchNearby, 15000);
    return () => clearInterval(interval);
  }, [fetchNearby]);

  const markers = nearbyDrivers.map((d) => ({
    id: d.id,
    lat: d.currentLat,
    lng: d.currentLng,
    icon: 'driver' as const,
  }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-triq-yellow">Live Map</h2>
        <button
          onClick={useMyLocation}
          disabled={locating}
          className="px-3 h-9 rounded-lg bg-triq-cyan/20 text-triq-cyan text-sm font-medium border border-triq-cyan/30 disabled:opacity-40 flex items-center gap-1.5"
        >
          {locating ? (
            <span className="inline-block w-3.5 h-3.5 border-2 border-triq-cyan/30 border-t-triq-cyan rounded-full animate-spin" />
          ) : (
            <Crosshair size={14} />
          )}
          My Location
        </button>
      </div>

      {geoError && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg px-3 py-2">
          <p className="text-orange-400 text-xs">{geoError}</p>
        </div>
      )}

      <div className="h-96 rounded-xl overflow-hidden border border-triq-light/20">
        <MapView center={center} zoom={14} markers={markers} />
      </div>
      <p className="text-sm text-gray-400">{nearbyDrivers.length} drivers nearby</p>
    </div>
  );
}
