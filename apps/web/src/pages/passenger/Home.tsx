import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../lib/api';
import MapView from '../../components/MapView';
import { getCurrentLocation, type GeoError } from '../../lib/geolocation';
import { Crosshair, MapPin, Navigation, Users, Backpack, GraduationCap, Accessibility, X, TrendingUp, Search, Plus } from 'lucide-react';

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
  counterOfferedFare: number | null;
  counterOfferExpiresAt: string | null;
  negotiatedFare: number | null;
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
  const [seniorCount, setSeniorCount] = useState(0);
  const [studentCount, setStudentCount] = useState(0);
  const [hasExtraBaggage, setHasExtraBaggage] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [fareEstimate, setFareEstimate] = useState<{ estimatedFare: number; perPersonFare: number; discountedPerPersonFare: number; distanceKm: number; discountApplied: boolean; baggageFee: number } | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [dropoffQuery, setDropoffQuery] = useState('');
  const [driverTip, setDriverTip] = useState(0);
  const [searchResults, setSearchResults] = useState<{ lat: number; lng: number; display_name: string }[]>([]);
  const [searching, setSearching] = useState(false);

  // Get passenger profile
  useEffect(() => {
    if (!user) return;
    api.get('/passengers', { params: { userId: user.id } })
      .then((res) => setPassengerId(res.data.id))
      .catch(() => {});
  }, [user]);

  // Track step in ref so polling interval doesn't get cleared on step changes
  const stepRef = useRef(step);
  stepRef.current = step;

  // Poll for active ride
  useEffect(() => {
    if (!passengerId) return;
    const poll = () => {
      api.get('/rides/active', { params: { passengerId } })
        .then((res) => {
          if (res.data.ride) {
            setActiveRide(res.data.ride);
            setStep('active');
          } else if (stepRef.current === 'active') {
            setActiveRide(null);
            setStep('idle');
          }
        })
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [passengerId]);

  // Fetch nearby drivers when pickup is set
  const fetchNearby = useCallback(async () => {
    if (!pickup) return;
    try {
      const { data } = await api.get('/drivers/nearby', { params: { lat: pickup.lat, lng: pickup.lng, radius: 2.5 } });
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

  // Nominatim place search for dropoff landmark/address lookup
  useEffect(() => {
    if (!dropoffQuery.trim() || dropoffQuery.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(dropoffQuery)}&format=json&limit=5&countrycodes=ph&q=Digos+${encodeURIComponent(dropoffQuery)}`)
        .then((res) => res.json())
        .then((data) => setSearchResults(data.map((r: any) => ({ lat: parseFloat(r.lat), lng: parseFloat(r.lon), display_name: r.display_name }))))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [dropoffQuery]);

  // Fetch fare estimate when pickup, dropoff, passenger count, discount counts, or baggage change
  useEffect(() => {
    if (!pickup || !dropoff) {
      setFareEstimate(null);
      return;
    }
    setEstimating(true);
    const timer = setTimeout(() => {
      api.get('/rides/estimate', {
        params: {
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          dropoffLat: dropoff.lat,
          dropoffLng: dropoff.lng,
          passengerCount,
          seniorCount,
          studentCount,
          hasExtraBaggage,
        },
      })
        .then((res) => setFareEstimate(res.data))
        .catch(() => setFareEstimate(null))
        .finally(() => setEstimating(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [pickup, dropoff, passengerCount, seniorCount, studentCount, hasExtraBaggage]);

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
        hasSeniorCitizen: seniorCount > 0,
        hasStudent: studentCount > 0,
        seniorCount,
        studentCount,
        hasExtraBaggage,
        driverTip,
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
    ...(pickup ? [{ id: 'pickup', lat: pickup.lat, lng: pickup.lng, icon: 'passenger' as const, label: 'A' }] : []),
    ...(dropoff ? [{ id: 'dropoff', lat: dropoff.lat, lng: dropoff.lng, icon: 'dropoff' as const, label: 'B' }] : []),
    ...nearbyDrivers.map((d) => ({ id: d.id, lat: d.currentLat, lng: d.currentLng, icon: 'tricycle' as const })),
    ...(activeRide?.driver?.currentLat ? [{ id: 'active-driver', lat: activeRide.driver.currentLat, lng: activeRide.driver.currentLng!, icon: 'tricycle' as const }] : []),
  ];

  const mapCenter: [number, number] = pickup ? [pickup.lat, pickup.lng] : DIGOS_CENTER;

  const countChip = (icon: React.ReactNode, label: string, count: number, setCount: (n: number) => void, max: number) => (
    <div className={`flex items-center gap-1 rounded-lg border ${
      count > 0 ? 'bg-triq-cyan/10 border-triq-cyan/30' : 'bg-triq-light/10 border-triq-light/20'
    }`}>
      <div className={`flex items-center gap-1 px-2.5 py-2 text-xs font-medium ${count > 0 ? 'text-triq-cyan' : 'text-gray-400'}`}>
        {icon}
        {label}
      </div>
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => setCount(Math.max(0, count - 1))}
          className="w-6 h-6 rounded text-sm font-bold text-gray-400 hover:text-white"
        >−</button>
        <span className={`w-4 text-center text-xs font-bold ${count > 0 ? 'text-triq-cyan' : 'text-gray-500'}`}>{count}</span>
        <button
          onClick={() => setCount(Math.min(max, count + 1))}
          className="w-6 h-6 rounded text-sm font-bold text-gray-400 hover:text-white"
        >+</button>
      </div>
    </div>
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
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={dropoff ? dropoff.address : dropoffQuery}
                    onChange={(e) => {
                      setDropoffQuery(e.target.value);
                      if (dropoff) setDropoff(null);
                    }}
                    placeholder="Search landmark or tap map"
                    className="w-full h-10 px-3 pl-9 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm truncate"
                  />
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  {searching && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-triq-cyan/30 border-t-triq-cyan rounded-full animate-spin" />
                  )}
                  {/* Search results dropdown */}
                  {searchResults.length > 0 && !dropoff && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-triq-dark border border-triq-light/30 rounded-lg shadow-xl z-[1000] max-h-48 overflow-y-auto">
                      {searchResults.map((r, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setDropoff({ lat: r.lat, lng: r.lng, address: r.display_name.split(',')[0] });
                            setDropoffQuery('');
                            setSearchResults([]);
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-triq-light/10 border-b border-triq-light/10 last:border-0 truncate"
                        >
                          <MapPin size={10} className="inline mr-1.5 text-red-400" />
                          {r.display_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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

          {/* Ride details — passenger count + counts */}
          <div className="card p-3 sm:p-4 space-y-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                <Users size={12} className="text-triq-cyan" /> Passengers
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    onClick={() => {
                      setPassengerCount(n);
                      if (seniorCount + studentCount > n) {
                        setSeniorCount(Math.min(seniorCount, n));
                        setStudentCount(Math.min(studentCount, n - seniorCount));
                      }
                    }}
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
                {countChip(<Accessibility size={14} />, 'Senior', seniorCount, setSeniorCount, passengerCount)}
                {countChip(<GraduationCap size={14} />, 'Student', studentCount, setStudentCount, passengerCount - seniorCount)}
              </div>
              <button
                onClick={() => setHasExtraBaggage(!hasExtraBaggage)}
                className={`mt-1.5 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all active:scale-95 ${
                  hasExtraBaggage
                    ? 'bg-triq-cyan/20 text-triq-cyan border border-triq-cyan/40'
                    : 'bg-triq-light/10 text-gray-400 border border-triq-light/20'
                }`}
              >
                <Backpack size={14} />
                Extra Baggage
              </button>
              {(seniorCount > 0 || studentCount > 0) && (
                <p className="text-[11px] text-gray-500 mt-1.5">20% LGU discount per qualifying passenger</p>
              )}
            </div>
          </div>

          {/* Fare estimate */}
          {pickup && dropoff && (
            <div className="card p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-triq-cyan" />
                  <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Fare Estimate</span>
                </div>
                {estimating ? (
                  <span className="inline-block w-4 h-4 border-2 border-triq-cyan/30 border-t-triq-cyan rounded-full animate-spin" />
                ) : fareEstimate ? (
                  <span className="text-triq-yellow font-bold text-xl">₱{((fareEstimate.estimatedFare + driverTip) / 100).toFixed(0)}</span>
                ) : (
                  <span className="text-gray-500 text-sm">—</span>
                )}
              </div>
              {fareEstimate && !estimating && (
                <>
                  <div className="mt-2 space-y-1 text-xs text-gray-400">
                    <div className="flex justify-between">
                      <span>Distance</span>
                      <span>{fareEstimate.distanceKm.toFixed(2)} km</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Per person</span>
                      <span>₱{(fareEstimate.perPersonFare / 100).toFixed(0)}{fareEstimate.discountApplied && ` (₱${(fareEstimate.discountedPerPersonFare / 100).toFixed(0)} w/ discount)`}</span>
                    </div>
                    {fareEstimate.baggageFee > 0 && (
                      <div className="flex justify-between">
                        <span>Baggage fee</span>
                        <span>₱{(fareEstimate.baggageFee / 100).toFixed(0)}</span>
                      </div>
                    )}
                    {fareEstimate.discountApplied && (
                      <p className="text-green-400 text-[11px] mt-1">20% LGU discount applied to qualifying passengers</p>
                    )}
                  </div>

                  {/* Driver tip buttons */}
                  <div className="mt-3 pt-3 border-t border-triq-light/10">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Plus size={12} className="text-triq-cyan" />
                      <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Add extra for driver (optional)</span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {[0, 100, 200, 500, 1000, 1500, 2000].map((amt) => (
                        <button
                          key={amt}
                          onClick={() => setDriverTip(amt)}
                          className={`px-2.5 h-8 rounded-lg text-xs font-medium transition-all active:scale-90 ${
                            driverTip === amt
                              ? 'bg-triq-cyan text-triq-dark'
                              : 'bg-triq-light/10 text-gray-400 hover:bg-triq-light/20'
                          }`}
                        >
                          {amt === 0 ? 'None' : `+₱${(amt / 100).toFixed(0)}`}
                        </button>
                      ))}
                    </div>
                    {driverTip > 0 && (
                      <p className="text-[11px] text-gray-500 mt-1.5">Added to driver's fare</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

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

          {/* Request button — shows fare estimate */}
          <button
            onClick={requestRide}
            disabled={loading || !pickup || !dropoff}
            className="w-full h-12 rounded-xl bg-triq-yellow text-triq-dark font-bold text-base
              active:scale-[0.97] transition-transform
              hover:shadow-neon-yellow disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? 'Requesting...' : (
              <>
                Request Ride
                {fareEstimate && !loading && (
                  <span className="text-sm opacity-80">· ₱{((fareEstimate.estimatedFare + driverTip) / 100).toFixed(0)}</span>
                )}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function ActiveRideCard({ ride, onCancel }: { ride: ActiveRide; onCancel: () => void }) {
  const [counterLoading, setCounterLoading] = useState(false);
  const counterFare = ride.counterOfferedFare ? ride.counterOfferedFare / 100 : null;
  const isCounterOffered = ride.status === 'COUNTER_OFFERED' && counterFare !== null;
  const isCounterAccepted = ride.status === 'COUNTER_OFFER_ACCEPTED' && ride.negotiatedFare;
  const fare = (isCounterAccepted ? ride.negotiatedFare! : ride.estimatedFare) / 100;
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

  const acceptCounter = async () => {
    setCounterLoading(true);
    try {
      await api.post(`/rides/${ride.id}/counter-offer/accept`);
    } catch {} finally {
      setCounterLoading(false);
    }
  };

  const rejectCounter = async () => {
    setCounterLoading(true);
    try {
      await api.post(`/rides/${ride.id}/counter-offer/reject`);
    } catch {} finally {
      setCounterLoading(false);
    }
  };

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">{statusLabels[ride.status] || ride.status}</h3>
        <span className="text-triq-yellow font-bold text-lg">₱{fare.toFixed(0)}</span>
      </div>

      {/* Counter-offer panel */}
      {isCounterOffered && (
        <div className="bg-triq-yellow/10 border border-triq-yellow/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-300">Driver proposes:</span>
            <span className="text-triq-yellow font-bold text-xl">₱{counterFare!.toFixed(0)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Original estimate:</span>
            <span className="text-gray-300 line-through">₱{fare.toFixed(0)}</span>
          </div>
          <p className="text-[11px] text-gray-500">Expires in 5 minutes. Accept to proceed at this fare, or reject to wait for another driver.</p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={acceptCounter}
              disabled={counterLoading}
              className="flex-1 h-10 rounded-lg bg-green-500 text-white font-bold text-sm active:scale-[0.97] disabled:opacity-40"
            >
              {counterLoading ? '...' : 'Accept'}
            </button>
            <button
              onClick={rejectCounter}
              disabled={counterLoading}
              className="flex-1 h-10 rounded-lg border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 disabled:opacity-40"
            >
              {counterLoading ? '...' : 'Reject'}
            </button>
          </div>
        </div>
      )}

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
