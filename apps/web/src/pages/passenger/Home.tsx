import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../lib/api';
import MapView from '../../components/MapView';

const DIGOS_CENTER: [number, number] = [6.7500, 125.3573];

interface NearbyDriver {
  id: string;
  name: string;
  plateNumber: string;
  rating: number;
  currentLat: number;
  currentLng: number;
  distance: number;
}

interface ActiveRide {
  id: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  estimatedFare: number;
  passenger: { name: string };
  driver?: { id: string; name: string; plateNumber: string; tricycleModel: string | null; rating: number; currentLat: number | null; currentLng: number | null };
}

export default function PassengerHome() {
  const { user } = useAuthStore();
  const [step, setStep] = useState<'idle' | 'searching' | 'active'>('idle');
  const [pickup, setPickup] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [dropoff, setDropoff] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [selecting, setSelecting] = useState<'pickup' | 'dropoff' | null>(null);
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriver[]>([]);
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passengerId, setPassengerId] = useState<string | null>(null);
  const [passengerCount, setPassengerCount] = useState(1);

  // Get passenger profile
  useEffect(() => {
    if (!user) return;
    api.get('/passengers', { params: { userId: user.id } })
      .then((res) => setPassengerId(res.data.id))
      .catch(() => {});
  }, [user]);

  // Poll for active ride
  useEffect(() => {
    if (!passengerId) return;
    const poll = () => {
      api.get('/rides/active', { params: { passengerId } })
        .then((res) => {
          if (res.data.ride) {
            setActiveRide(res.data.ride);
            setStep('active');
          } else if (step === 'active') {
            setActiveRide(null);
            setStep('idle');
          }
        })
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [passengerId, step]);

  // Fetch nearby drivers when pickup is set
  const fetchNearby = useCallback(async () => {
    if (!pickup) return;
    try {
      const { data } = await api.get('/drivers/nearby', { params: { lat: pickup.lat, lng: pickup.lng, radius: 3 } });
      setNearbyDrivers(data.drivers);
    } catch {}
  }, [pickup]);

  useEffect(() => {
    if (pickup && step === 'idle') {
      fetchNearby();
      const interval = setInterval(fetchNearby, 10000);
      return () => clearInterval(interval);
    }
  }, [pickup, step, fetchNearby]);

  const handleMapClick = (lat: number, lng: number) => {
    const address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    if (selecting === 'pickup') {
      setPickup({ lat, lng, address });
      setSelecting(null);
    } else if (selecting === 'dropoff') {
      setDropoff({ lat, lng, address });
      setSelecting(null);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      setPickup({ lat: latitude, lng: longitude, address: 'Current location' });
      setSelecting(null);
    });
  };

  const requestRide = async () => {
    if (!passengerId || !pickup || !dropoff) return;
    setLoading(true);
    setError('');
    try {
      await api.post('/rides', {
        passengerId,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        pickupAddress: pickup.address,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        dropoffAddress: dropoff.address,
        passengerCount,
      });
      setStep('searching');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to request ride');
    } finally {
      setLoading(false);
    }
  };

  const cancelRide = async () => {
    if (!activeRide) return;
    try {
      await api.post(`/rides/${activeRide.id}/cancel`, { reason: 'Cancelled by passenger' });
      setActiveRide(null);
      setStep('idle');
    } catch {}
  };

  const mapMarkers = [
    ...(pickup ? [{ id: 'pickup', lat: pickup.lat, lng: pickup.lng, icon: 'pickup' as const, label: 'A' }] : []),
    ...(dropoff ? [{ id: 'dropoff', lat: dropoff.lat, lng: dropoff.lng, icon: 'dropoff' as const, label: 'B' }] : []),
    ...nearbyDrivers.map((d) => ({ id: d.id, lat: d.currentLat, lng: d.currentLng, icon: 'driver' as const })),
    ...(activeRide?.driver?.currentLat ? [{ id: 'active-driver', lat: activeRide.driver.currentLat, lng: activeRide.driver.currentLng!, icon: 'driver' as const }] : []),
  ];

  const mapCenter: [number, number] = pickup ? [pickup.lat, pickup.lng] : DIGOS_CENTER;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-triq-yellow">Book a Ride</h2>
        {step === 'idle' && (
          <span className="text-xs text-gray-400">{nearbyDrivers.length} drivers nearby</span>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {step === 'active' && activeRide ? (
        <ActiveRideCard ride={activeRide} onCancel={cancelRide} />
      ) : step === 'searching' ? (
        <div className="bg-triq-slate rounded-xl border border-triq-light/20 p-6 text-center">
          <div className="inline-block w-8 h-8 border-2 border-triq-cyan/30 border-t-triq-cyan rounded-full animate-spin mb-3" />
          <p className="text-white font-semibold">Searching for drivers...</p>
          <p className="text-gray-400 text-sm mt-1">Waiting for a driver to accept your ride</p>
          <button onClick={cancelRide} className="mt-4 text-sm text-red-400 hover:text-red-300">
            Cancel request
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Pickup & Dropoff inputs */}
          <div className="bg-triq-slate rounded-xl border border-triq-light/20 p-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Pickup Location
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pickup?.address || ''}
                  readOnly
                  placeholder="Tap map or use location"
                  className="flex-1 h-10 px-3 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm"
                />
                <button
                  onClick={() => setSelecting('pickup')}
                  className={`px-3 h-10 rounded-lg text-sm font-medium ${selecting === 'pickup' ? 'bg-triq-cyan text-triq-dark' : 'bg-triq-light/10 text-gray-300'}`}
                >
                  Map
                </button>
                <button
                  onClick={useMyLocation}
                  className="px-3 h-10 rounded-lg text-sm font-medium bg-triq-light/10 text-gray-300 hover:bg-triq-light/20"
                >
                  GPS
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Dropoff Location
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={dropoff?.address || ''}
                  readOnly
                  placeholder="Tap map to set destination"
                  className="flex-1 h-10 px-3 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm"
                />
                <button
                  onClick={() => setSelecting('dropoff')}
                  className={`px-3 h-10 rounded-lg text-sm font-medium ${selecting === 'dropoff' ? 'bg-triq-cyan text-triq-dark' : 'bg-triq-light/10 text-gray-300'}`}
                >
                  Map
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Passengers
              </label>
              <select
                value={passengerCount}
                onChange={(e) => setPassengerCount(parseInt(e.target.value))}
                className="h-10 px-3 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>{n} passenger{n > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {selecting && (
            <div className="bg-triq-cyan/10 border border-triq-cyan/30 rounded-lg px-3 py-2 text-sm text-triq-cyan">
              Tap the map to set {selecting === 'pickup' ? 'pickup' : 'dropoff'} location
            </div>
          )}

          {/* Map */}
          <div className="h-80 rounded-xl overflow-hidden border border-triq-light/20">
            <MapView
              center={mapCenter}
              zoom={14}
              markers={mapMarkers}
              onMapClick={handleMapClick}
              fitBounds={!!(pickup && dropoff)}
            />
          </div>

          {/* Nearby drivers list */}
          {pickup && nearbyDrivers.length > 0 && (
            <div className="bg-triq-slate rounded-xl border border-triq-light/20 p-3">
              <p className="text-xs text-gray-400 mb-2">Nearby drivers</p>
              <div className="space-y-1.5">
                {nearbyDrivers.slice(0, 3).map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-sm">
                    <span className="text-white">{d.name}</span>
                    <span className="text-gray-400">{d.distance.toFixed(1)} km · ⭐ {d.rating.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Request button */}
          <button
            onClick={requestRide}
            disabled={loading || !pickup || !dropoff}
            className="w-full h-12 rounded-xl bg-triq-yellow text-triq-dark font-bold text-base
              active:scale-[0.97] transition-transform
              hover:shadow-neon-yellow disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Requesting...' : 'Request Ride'}
          </button>
        </div>
      )}
    </div>
  );
}

function ActiveRideCard({ ride, onCancel }: { ride: ActiveRide; onCancel: () => void }) {
  const fare = ride.estimatedFare / 100;
  const statusLabels: Record<string, string> = {
    REQUESTED: 'Waiting for driver...',
    ACCEPTED: 'Driver assigned — heading to pickup',
    COUNTER_OFFERED: 'Counter-offer received!',
    COUNTER_OFFER_ACCEPTED: 'Counter-offer accepted',
    ARRIVING: 'Driver is arriving',
    IN_PROGRESS: 'Ride in progress',
    COMPLETED: 'Ride completed',
    CANCELLED: 'Ride cancelled',
  };

  return (
    <div className="bg-triq-slate rounded-xl border border-triq-light/20 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">{statusLabels[ride.status] || ride.status}</h3>
        <span className="text-triq-yellow font-bold text-lg">₱{fare.toFixed(0)}</span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
          <div>
            <p className="text-gray-400 text-xs">Pickup</p>
            <p className="text-white">{ride.pickupAddress}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5" />
          <div>
            <p className="text-gray-400 text-xs">Dropoff</p>
            <p className="text-white">{ride.dropoffAddress}</p>
          </div>
        </div>
      </div>

      {ride.driver && (
        <div className="bg-triq-dark rounded-lg p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-triq-cyan/20 flex items-center justify-center text-triq-cyan font-bold">
            {ride.driver.name.charAt(0)}
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold text-sm">{ride.driver.name}</p>
            <p className="text-gray-400 text-xs">{ride.driver.plateNumber} · ⭐ {ride.driver.rating.toFixed(1)}</p>
          </div>
        </div>
      )}

      {!['COMPLETED', 'CANCELLED'].includes(ride.status) && (
        <button
          onClick={onCancel}
          className="w-full h-10 rounded-lg border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10"
        >
          Cancel Ride
        </button>
      )}
    </div>
  );
}
