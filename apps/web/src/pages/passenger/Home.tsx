import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../lib/api';
import MapView from '../../components/MapView';
import { getCurrentLocation, type GeoError } from '../../lib/geolocation';
import { Crosshair, MapPin, Navigation, Users, Backpack, GraduationCap, Accessibility, X } from 'lucide-react';

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
  const [hasSeniorCitizen, setHasSeniorCitizen] = useState(false);
  const [hasStudent, setHasStudent] = useState(false);
  const [hasExtraBaggage, setHasExtraBaggage] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');

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

  const useMyLocation = async () => {
    setLocating(true);
    setGeoError('');
    try {
      const pos = await getCurrentLocation();
      setPickup({ lat: pos.lat, lng: pos.lng, address: 'Current location' });
      setSelecting(null);
    } catch (err) {
      const geoErr = err as GeoError;
      setGeoError(geoErr.message);
    } finally {
      setLocating(false);
    }
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
        hasSeniorCitizen,
        hasStudent,
        hasExtraBaggage,
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

  const toggleChip = (active: boolean, setter: (v: boolean) => void, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setter(!active)}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all active:scale-95 ${
        active
          ? 'bg-triq-cyan/20 text-triq-cyan border border-triq-cyan/40'
          : 'bg-triq-light/10 text-gray-400 border border-triq-light/20'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-triq-yellow">Book a Ride</h2>
        {step === 'idle' && (
          <span className="text-xs text-gray-400">{nearbyDrivers.length} nearby</span>
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
        <div className="card p-6 text-center">
          <div className="inline-block w-8 h-8 border-2 border-triq-cyan/30 border-t-triq-cyan rounded-full animate-spin mb-3" />
          <p className="text-white font-semibold">Searching for drivers...</p>
          <p className="text-gray-400 text-sm mt-1">Waiting for a driver to accept</p>
          <button onClick={cancelRide} className="mt-4 text-sm text-red-400 hover:text-red-300">
            Cancel request
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Location card */}
          <div className="card p-3 sm:p-4 space-y-3">
            {/* Pickup */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                <MapPin size={12} className="text-green-400" /> Pickup
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pickup?.address || ''}
                  readOnly
                  placeholder="Use GPS or tap map"
                  className="flex-1 h-10 px-3 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm truncate"
                />
                <button
                  onClick={() => setSelecting(selecting === 'pickup' ? null : 'pickup')}
                  className={`px-2.5 h-10 rounded-lg text-xs font-medium shrink-0 flex items-center gap-1 ${
                    selecting === 'pickup' ? 'bg-triq-cyan text-triq-dark' : 'bg-triq-light/10 text-gray-300'
                  }`}
                >
                  <MapPin size={14} />
                  Pin
                </button>
                <button
                  onClick={useMyLocation}
                  disabled={locating}
                  className="px-2.5 h-10 rounded-lg text-xs font-medium shrink-0 bg-triq-light/10 text-gray-300 hover:bg-triq-light/20 disabled:opacity-40 flex items-center gap-1"
                >
                  {locating ? (
                    <span className="inline-block w-3.5 h-3.5 border-2 border-triq-cyan/30 border-t-triq-cyan rounded-full animate-spin" />
                  ) : (
                    <Crosshair size={14} />
                  )}
                </button>
              </div>
            </div>

            {/* Dropoff */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                <Navigation size={12} className="text-red-400" /> Dropoff
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={dropoff?.address || ''}
                  readOnly
                  placeholder="Tap map to set destination"
                  className="flex-1 h-10 px-3 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm truncate"
                />
                <button
                  onClick={() => setSelecting(selecting === 'dropoff' ? null : 'dropoff')}
                  className={`px-2.5 h-10 rounded-lg text-xs font-medium shrink-0 flex items-center gap-1 ${
                    selecting === 'dropoff' ? 'bg-triq-cyan text-triq-dark' : 'bg-triq-light/10 text-gray-300'
                  }`}
                >
                  <Navigation size={14} />
                  Pin
                </button>
              </div>
            </div>

            {/* Selecting hint */}
            {selecting && (
              <div className="flex items-center justify-between bg-triq-cyan/10 border border-triq-cyan/30 rounded-lg px-3 py-2">
                <p className="text-triq-cyan text-xs">
                  Tap map to set {selecting === 'pickup' ? 'pickup' : 'dropoff'}
                </p>
                <button onClick={() => setSelecting(null)} className="text-triq-cyan/70 hover:text-triq-cyan">
                  <X size={14} />
                </button>
              </div>
            )}

            {geoError && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg px-3 py-2">
                <p className="text-orange-400 text-xs">{geoError}</p>
              </div>
            )}
          </div>

          {/* Map — full width, taller on mobile */}
          <div className="h-64 sm:h-80 rounded-xl overflow-hidden border border-triq-light/20 relative">
            <MapView
              center={mapCenter}
              zoom={14}
              markers={mapMarkers}
              onMapClick={handleMapClick}
              fitBounds={!!(pickup && dropoff)}
            />
            {selecting && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-triq-dark/90 backdrop-blur-sm px-3 py-1.5 rounded-full border border-triq-cyan/30 z-[1000] pointer-events-none">
                <p className="text-triq-cyan text-xs font-medium">
                  Tap to pin {selecting === 'pickup' ? 'pickup' : 'dropoff'}
                </p>
              </div>
            )}
          </div>

          {/* Ride details — passenger count + toggles */}
          <div className="card p-3 sm:p-4 space-y-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                <Users size={12} className="text-triq-cyan" /> Passengers
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    onClick={() => setPassengerCount(n)}
                    className={`w-9 h-9 rounded-lg text-sm font-bold transition-all active:scale-90 ${
                      passengerCount === n
                        ? 'bg-triq-yellow text-triq-dark'
                        : 'bg-triq-light/10 text-gray-400 hover:bg-triq-light/20'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 block">
                Additional Info
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {toggleChip(hasSeniorCitizen, setHasSeniorCitizen, <Accessibility size={14} />, 'Senior')}
                {toggleChip(hasStudent, setHasStudent, <GraduationCap size={14} />, 'Student')}
                {toggleChip(hasExtraBaggage, setHasExtraBaggage, <Backpack size={14} />, 'Baggage')}
              </div>
              {(hasSeniorCitizen || hasStudent) && (
                <p className="text-[11px] text-gray-500 mt-1.5">20% LGU discount may apply</p>
              )}
            </div>
          </div>

          {/* Nearby drivers — compact */}
          {pickup && nearbyDrivers.length > 0 && (
            <div className="card p-3">
              <p className="text-xs text-gray-400 mb-2">Nearby drivers</p>
              <div className="space-y-1.5">
                {nearbyDrivers.slice(0, 3).map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-sm">
                    <span className="text-white truncate">{d.name}</span>
                    <span className="text-gray-400 shrink-0 ml-2">{d.distance.toFixed(1)}km · ⭐{d.rating.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Request button — sticky at bottom */}
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
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">{statusLabels[ride.status] || ride.status}</h3>
        <span className="text-triq-yellow font-bold text-lg">₱{fare.toFixed(0)}</span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-gray-400 text-xs">Pickup</p>
            <p className="text-white truncate">{ride.pickupAddress}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-gray-400 text-xs">Dropoff</p>
            <p className="text-white truncate">{ride.dropoffAddress}</p>
          </div>
        </div>
      </div>

      {ride.driver && (
        <div className="bg-triq-dark rounded-lg p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-triq-cyan/20 flex items-center justify-center text-triq-cyan font-bold shrink-0">
            {ride.driver.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{ride.driver.name}</p>
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
