import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../lib/api';
import MapView from '../../components/MapView';
import { getCurrentLocation, type GeoError } from '../../lib/geolocation';
import { Crosshair, MapPin, Navigation, Users, Backpack, GraduationCap, Accessibility, X, TrendingUp, Search, Plus, Phone, AlertTriangle, Share2, Star, ThumbsUp, ThumbsDown, Clock } from 'lucide-react';

const DIGOS_CENTER: [number, number] = [6.7500, 125.3573];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

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
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  estimatedFare: number;
  counterOfferedFare: number | null;
  counterOfferExpiresAt: string | null;
  negotiatedFare: number | null;
  startedAt: string | null;
  completedAt: string | null;
  passenger: { name: string };
  driver?: { id: string; name: string; plateNumber: string; tricycleModel: string | null; rating: number; currentLat: number | null; currentLng: number | null; user?: { phoneNumber: string } };
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
  const [customTip, setCustomTip] = useState('');
  const [showCustomTip, setShowCustomTip] = useState(false);
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

  // Fetch nearby drivers when pickup is set or on mount using GPS
  const fetchNearby = useCallback(async (lat?: number, lng?: number) => {
    const queryLat = lat ?? pickup?.lat;
    const queryLng = lng ?? pickup?.lng;
    if (!queryLat || !queryLng) return;
    try {
      const { data } = await api.get('/drivers/nearby', { params: { lat: queryLat, lng: queryLng, radius: 2.5 } });
      setNearbyDrivers(data.drivers);
    } catch (err: any) {
      console.error('Failed to fetch nearby drivers:', err?.response?.data || err?.message);
    }
  }, [pickup]);

  // On mount, try to get GPS location and fetch nearby drivers immediately
  useEffect(() => {
    if (step !== 'idle') return;
    getCurrentLocation()
      .then((pos) => {
        if (!pickup) {
          setPickup({ lat: pos.lat, lng: pos.lng, address: 'Current location' });
        }
        fetchNearby(pos.lat, pos.lng);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (pickup && step === 'idle') {
      fetchNearby();
      const interval = setInterval(() => fetchNearby(), 10000);
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

  const cancelRide = async (reason?: string) => {
    if (!activeRide) return;
    try {
      await api.post(`/rides/${activeRide.id}/cancel`, { reason: reason || 'Cancelled by passenger' });
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
          <button onClick={() => cancelRide()} className="mt-4 text-sm text-red-400 hover:text-red-300">
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
                          onClick={() => { setDriverTip(amt); setShowCustomTip(false); }}
                          className={`px-2.5 h-8 rounded-lg text-xs font-medium transition-all active:scale-90 ${
                            driverTip === amt && !showCustomTip
                              ? 'bg-triq-cyan text-triq-dark'
                              : 'bg-triq-light/10 text-gray-400 hover:bg-triq-light/20'
                          }`}
                        >
                          {amt === 0 ? 'None' : `+₱${(amt / 100).toFixed(0)}`}
                        </button>
                      ))}
                      <button
                        onClick={() => { setShowCustomTip(true); setDriverTip(0); }}
                        className={`px-2.5 h-8 rounded-lg text-xs font-medium transition-all active:scale-90 ${
                          showCustomTip
                            ? 'bg-triq-cyan text-triq-dark'
                            : 'bg-triq-light/10 text-gray-400 hover:bg-triq-light/20'
                        }`}
                      >
                        Custom
                      </button>
                    </div>
                    {showCustomTip && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-gray-400">₱</span>
                        <input
                          type="number"
                          min="1"
                          max="500"
                          value={customTip}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomTip(val);
                            const parsed = parseInt(val) || 0;
                            setDriverTip(parsed > 0 ? parsed * 100 : 0);
                          }}
                          placeholder="Enter amount"
                          className="w-28 h-8 px-2 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm"
                        />
                      </div>
                    )}
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

function ReportModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (category: string, description: string) => void }) {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  const categories = [
    'Unsafe driving',
    'Overcharging / fare dispute',
    'Rude behavior',
    'Vehicle issue',
    'No-show / abandoned ride',
    'Harassment',
    'Other',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-triq-slate rounded-xl border border-triq-light/30 p-5 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Report an issue</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-1.5">
          {categories.map((c) => (
            <label key={c} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="reportCategory" value={c} checked={category === c} onChange={() => setCategory(c)} className="accent-orange-400" />
              <span className="text-sm text-white">{c}</span>
            </label>
          ))}
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what happened (optional)"
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm resize-none"
        />
        <button
          onClick={() => category && onSubmit(category, description)}
          disabled={!category}
          className="w-full h-10 rounded-lg bg-orange-500 text-white font-bold text-sm disabled:opacity-40"
        >
          Submit Report
        </button>
      </div>
    </div>
  );
}
function ActiveRideCard({ ride, onCancel }: { ride: ActiveRide; onCancel: (reason?: string) => void }) {
  const [counterLoading, setCounterLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelOther, setCancelOther] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [thumbsUp, setThumbsUp] = useState<boolean | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [emergencyHoldProgress, setEmergencyHoldProgress] = useState(0);
  const [emergencyTriggered, setEmergencyTriggered] = useState(false);
  const [, setTick] = useState(0);
  const emergencyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const counterFare = ride.counterOfferedFare ? ride.counterOfferedFare / 100 : null;
  const isCounterOffered = ride.status === 'COUNTER_OFFERED' && counterFare !== null;
  const isCounterAccepted = ride.status === 'COUNTER_OFFER_ACCEPTED' && ride.negotiatedFare;
  const fare = (isCounterAccepted ? ride.negotiatedFare! : ride.estimatedFare) / 100;
  const isInProgress = ride.status === 'IN_PROGRESS';
  const isCompleted = ride.status === 'COMPLETED';

  useEffect(() => {
    if (!isInProgress) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isInProgress]);

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

  const cancelReasons = [
    'Changed my mind',
    'Driver too far / taking too long',
    'Found another ride',
    'Unsafe driving',
    'Overcharging / fare dispute',
    'Rude behavior',
    'Vehicle issue',
    'Other (please specify)',
  ];

  const handleCancelClick = () => {
    if (isInProgress) {
      setShowCancelModal(true);
    } else {
      onCancel();
    }
  };

  const confirmCancel = () => {
    const reason = cancelReason === 'Other (please specify)' ? cancelOther : cancelReason;
    setShowCancelModal(false);
    setCancelReason('');
    setCancelOther('');
    onCancel(reason || 'Cancelled by passenger');
  };

  const startEmergencyHold = () => {
    setShowEmergency(true);
    setEmergencyHoldProgress(0);
    let progress = 0;
    emergencyTimerRef.current = setInterval(() => {
      progress += 100 / 30;
      setEmergencyHoldProgress(progress);
      if (progress >= 100) {
        if (emergencyTimerRef.current) clearInterval(emergencyTimerRef.current);
        triggerEmergency();
      }
    }, 100);
  };

  const cancelEmergencyHold = () => {
    if (emergencyTimerRef.current) clearInterval(emergencyTimerRef.current);
    setShowEmergency(false);
    setEmergencyHoldProgress(0);
  };

  const triggerEmergency = async () => {
    setEmergencyTriggered(true);
    setShowEmergency(false);
    setEmergencyHoldProgress(0);
    try {
      await api.post(`/rides/${ride.id}/emergency`, { description: 'Emergency triggered by passenger' });
    } catch {}
  };

  const shareRide = () => {
    const text = `TriQ Ride: ${ride.pickupAddress} → ${ride.dropoffAddress} | Fare: ₱${fare.toFixed(0)}${ride.driver ? ` | Driver: ${ride.driver.name} (${ride.driver.plateNumber})` : ''}`;
    if (navigator.share) {
      navigator.share({ title: 'My TriQ Ride', text });
    } else {
      navigator.clipboard?.writeText(text);
    }
  };

  const submitReview = async () => {
    if (rating === 0) return;
    try {
      await api.post(`/rides/${ride.id}/review`, { rating, thumbsUp, comment: reviewComment });
      setReviewSubmitted(true);
      setTimeout(() => setShowRateModal(false), 1500);
    } catch {}
  };

  const submitReport = async (category: string, description: string) => {
    try {
      await api.post('/reports', { rideId: ride.id, category, description });
      setShowReport(false);
    } catch {}
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
        <div className="text-right">
          {isCounterAccepted && (
            <span className="text-gray-500 line-through text-xs mr-1">₱{(ride.estimatedFare / 100).toFixed(0)}</span>
          )}
          <span className="text-triq-yellow font-bold text-lg">₱{fare.toFixed(0)}</span>
        </div>
      </div>

      {/* Ride status timeline */}
      <div className="flex items-center gap-1 text-xs">
        {['REQUESTED', 'ACCEPTED', 'ARRIVING', 'IN_PROGRESS', 'COMPLETED'].map((s, i) => {
          const statusOrder = ['REQUESTED', 'ACCEPTED', 'COUNTER_OFFERED', 'COUNTER_OFFER_ACCEPTED', 'ARRIVING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
          const rideOrder = statusOrder.indexOf(ride.status);
          const stepOrder = statusOrder.indexOf(s);
          const isActive = stepOrder <= rideOrder;
          const isCurrent = s === ride.status;
          return (
            <div key={s} className="flex items-center flex-1">
              <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? (isCurrent ? 'bg-triq-cyan ring-2 ring-triq-cyan/30' : 'bg-triq-cyan/60') : 'bg-triq-light/20'}`} />
              {i < 4 && <div className={`flex-1 h-0.5 ${isActive && stepOrder < rideOrder ? 'bg-triq-cyan/40' : 'bg-triq-light/10'}`} />}
            </div>
          );
        })}
      </div>

      {/* ETA during in-progress */}
      {isInProgress && (() => {
        const dist = ride.driver?.currentLat && ride.driver?.currentLng
          ? haversineKm(ride.driver.currentLat, ride.driver.currentLng, ride.dropoffLat, ride.dropoffLng)
          : 0;
        const baseEta = Math.max(1, Math.round(dist * 3));
        const etaMin = Math.max(1, baseEta - 1);
        const etaMax = baseEta + 3;
        const elapsedMs = ride.startedAt ? Date.now() - new Date(ride.startedAt).getTime() : 0;
        return (
          <div className="bg-triq-cyan/10 border border-triq-cyan/30 rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-triq-cyan text-sm font-semibold">Estimated arrival: {etaMin}–{etaMax} min</p>
              {dist > 0 && <p className="text-xs text-gray-400 mt-0.5">{dist.toFixed(2)} km away</p>}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 font-mono flex items-center gap-1"><Clock size={10} /> {formatElapsed(elapsedMs)}</p>
            </div>
          </div>
        );
      })()}

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
          {ride.driver.user?.phoneNumber && (
            <a
              href={`tel:${ride.driver.user.phoneNumber}`}
              className="shrink-0 w-9 h-9 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 flex items-center justify-center active:scale-90"
              title="Call driver"
            >
              <Phone size={16} />
            </a>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {!['COMPLETED', 'CANCELLED'].includes(ride.status) && (
          <>
            <button
              onPointerDown={startEmergencyHold}
              onPointerUp={cancelEmergencyHold}
              onPointerLeave={cancelEmergencyHold}
              className={`flex-1 h-10 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 select-none ${
                emergencyTriggered ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}
            >
              <AlertTriangle size={14} />
              {emergencyTriggered ? 'Alert Sent' : 'Emergency'}
            </button>
            <button
              onClick={shareRide}
              className="h-10 w-10 rounded-lg bg-triq-light/10 text-gray-300 border border-triq-light/20 flex items-center justify-center active:scale-90 shrink-0"
              title="Share ride details"
            >
              <Share2 size={16} />
            </button>
          </>
        )}
        {isCompleted && !reviewSubmitted && (
          <button
            onClick={() => setShowRateModal(true)}
            className="flex-1 h-10 rounded-lg bg-triq-yellow text-triq-dark text-sm font-bold flex items-center justify-center gap-1.5"
          >
            <Star size={14} />
            Rate Driver
          </button>
        )}
        {reviewSubmitted && (
          <div className="flex-1 h-10 rounded-lg bg-green-500/10 text-green-400 text-sm font-medium flex items-center justify-center gap-1.5">
            <ThumbsUp size={14} /> Thanks for rating!
          </div>
        )}
        {!['CANCELLED'].includes(ride.status) && (
          <button
            onClick={() => setShowReport(true)}
            className="h-10 px-3 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/30 text-xs font-medium"
          >
            Report
          </button>
        )}
      </div>

      {!['COMPLETED', 'CANCELLED'].includes(ride.status) && (
        <button
          onClick={handleCancelClick}
          className="w-full h-10 rounded-lg border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10"
        >
          Cancel Ride
        </button>
      )}

      {/* Emergency hold overlay */}
      {showEmergency && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onPointerUp={cancelEmergencyHold}>
          <div className="text-center space-y-4">
            <div className="w-24 h-24 mx-auto rounded-full bg-red-500/20 border-4 border-red-500/40 flex items-center justify-center relative">
              <AlertTriangle size={36} className="text-red-400" />
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" fill="none" stroke="rgb(239 68 68)" strokeWidth="4" strokeDasharray={`${(emergencyHoldProgress / 100) * 289} 289`} strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-white font-bold text-lg">Hold to trigger emergency</p>
            <p className="text-gray-400 text-sm">Keep holding for 3 seconds to alert your emergency contact and TriQ admin</p>
          </div>
        </div>
      )}

      {/* Rate driver modal */}
      {showRateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowRateModal(false)}>
          <div className="bg-triq-slate rounded-xl border border-triq-light/30 p-5 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white">Rate your driver</h3>
            <div className="flex gap-1 justify-center">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)} className="active:scale-90 transition-transform">
                  <Star size={32} className={n <= rating ? 'text-triq-yellow fill-triq-yellow' : 'text-gray-600'} />
                </button>
              ))}
            </div>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setThumbsUp(true)} className={`px-4 h-10 rounded-lg flex items-center gap-1.5 text-sm font-medium ${thumbsUp === true ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-triq-light/10 text-gray-400'}`}>
                <ThumbsUp size={14} /> Good
              </button>
              <button onClick={() => setThumbsUp(false)} className={`px-4 h-10 rounded-lg flex items-center gap-1.5 text-sm font-medium ${thumbsUp === false ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-triq-light/10 text-gray-400'}`}>
                <ThumbsDown size={14} /> Bad
              </button>
            </div>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Leave a comment (optional)"
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm resize-none"
            />
            <button
              onClick={submitReview}
              disabled={rating === 0}
              className="w-full h-10 rounded-lg bg-triq-yellow text-triq-dark font-bold text-sm disabled:opacity-40"
            >
              Submit Review
            </button>
          </div>
        </div>
      )}

      {/* Report modal */}
      {showReport && (
        <ReportModal onClose={() => setShowReport(false)} onSubmit={submitReport} />
      )}

      {/* Cancel confirmation modal for in-progress rides */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-triq-slate rounded-xl border border-triq-light/30 p-5 max-w-sm w-full space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white">Cancel this ride?</h3>
              <p className="text-sm text-gray-400 mt-1">
                The ride is currently in progress. Cancelling will notify the driver. Please select a reason:
              </p>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {cancelReasons.map((r) => (
                <label key={r} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cancelReason"
                    value={r}
                    checked={cancelReason === r}
                    onChange={() => setCancelReason(r)}
                    className="accent-triq-cyan"
                  />
                  <span className="text-sm text-white">{r}</span>
                </label>
              ))}
            </div>
            {cancelReason === 'Other (please specify)' && (
              <input
                type="text"
                value={cancelOther}
                onChange={(e) => setCancelOther(e.target.value)}
                placeholder="Please specify..."
                className="w-full h-10 px-3 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm"
              />
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowCancelModal(false); setCancelReason(''); setCancelOther(''); }}
                className="flex-1 h-10 rounded-lg border border-triq-light/30 text-gray-300 text-sm font-medium"
              >
                Keep Ride
              </button>
              <button
                onClick={confirmCancel}
                disabled={!cancelReason || (cancelReason === 'Other (please specify)' && !cancelOther)}
                className="flex-1 h-10 rounded-lg bg-red-500 text-white font-bold text-sm disabled:opacity-40"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
