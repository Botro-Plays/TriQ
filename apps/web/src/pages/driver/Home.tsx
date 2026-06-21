import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../lib/api';
import MapView from '../../components/MapView';
import { getCurrentLocation, watchLocation, clearWatch, type GeoError } from '../../lib/geolocation';
import { Phone, Navigation, X, ThumbsUp, ThumbsDown, Heart } from 'lucide-react';

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

const DIGOS_CENTER: [number, number] = [6.7500, 125.3573];

interface PendingRide {
  id: string;
  status: string;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffAddress: string;
  estimatedFare: number;
  passengerCount: number;
  hasSeniorCitizen: boolean;
  hasStudent: boolean;
  hasExtraBaggage: boolean;
  passenger: { name: string; user?: { phoneNumber: string } };
  preferredDriverId?: string | null;
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
  passenger: { id: string; name: string; user: { phoneNumber: string } };
}

interface EarningsSummary {
  today: { earnings: number; rides: number };
  week: { earnings: number; rides: number };
  total: { earnings: number; rides: number };
}

export default function DriverHome() {
  const { user } = useAuthStore();
  const [isOnline, setIsOnline] = useState(false);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingRides, setPendingRides] = useState<PendingRide[]>([]);
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [counterOfferFare, setCounterOfferFare] = useState<string>('');
  const [counterOfferRideId, setCounterOfferRideId] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const speedHistoryRef = useRef<{ time: number; lat: number; lng: number }[]>([]);
  const [, setTick] = useState(0);
  const [feedbackRideId, setFeedbackRideId] = useState<string | null>(null);
  const [feedbackPassengerName, setFeedbackPassengerName] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  // Platform tip state
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState(0);
  const [tipCustom, setTipCustom] = useState('');
  const [tipping, setTipping] = useState(false);
  const [tipSuccess, setTipSuccess] = useState(false);

  // Get driver profile
  useEffect(() => {
    if (!user) return;
    api.get('/drivers', { params: { userId: user.id } })
      .then((res) => {
        setDriverId(res.data.id);
        setIsOnline(res.data.isOnline);
        // If already online, restore location from DB and restart location watch
        if (res.data.isOnline && res.data.currentLat && res.data.currentLng) {
          setLocation({ lat: res.data.currentLat, lng: res.data.currentLng });
          speedHistoryRef.current = [{ time: Date.now(), lat: res.data.currentLat, lng: res.data.currentLng }];
          const id = watchLocation(
            (pos) => {
              setLocation({ lat: pos.lat, lng: pos.lng });
              speedHistoryRef.current.push({ time: Date.now(), lat: pos.lat, lng: pos.lng });
              if (speedHistoryRef.current.length > 20) speedHistoryRef.current.shift();
              api.patch(`/drivers/${res.data.id}/location`, { lat: pos.lat, lng: pos.lng }).catch(() => {});
            },
            (err) => { setError(err.message); },
          );
          watchIdRef.current = id;
        }
      })
      .catch(() => {});
  }, [user]);

  // Poll for active ride
  useEffect(() => {
    if (!driverId) return;
    const poll = () => {
      api.get('/rides/active', { params: { driverId } })
        .then((res) => {
          if (res.data.ride) {
            setActiveRide(res.data.ride);
            setPendingRides([]);
          } else {
            setActiveRide(null);
          }
        })
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [driverId]);

  const goOnline = async () => {
    if (!driverId) return;
    try {
      const pos = await getCurrentLocation();
      setLocation({ lat: pos.lat, lng: pos.lng });
      await api.patch(`/drivers/${driverId}/online`, { lat: pos.lat, lng: pos.lng });
      setIsOnline(true);

      // Start watching position for live map pin + server updates
      const watchId = watchLocation(
        (p) => {
          setLocation({ lat: p.lat, lng: p.lng });
          speedHistoryRef.current.push({ time: Date.now(), lat: p.lat, lng: p.lng });
          if (speedHistoryRef.current.length > 20) speedHistoryRef.current.shift();
          api.patch(`/drivers/${driverId}/location`, { lat: p.lat, lng: p.lng }).catch(() => {});
        },
        (err: GeoError) => {
          if (err.code === 'PERMISSION_DENIED') {
            setError('Location permission was denied. Please enable location services to stay online.');
            goOffline();
          }
        }
      );
      watchIdRef.current = watchId;

      // Fetch earnings summary for dashboard
      api.get(`/drivers/${driverId}/earnings`).then((res) => setEarnings(res.data)).catch(() => {});
    } catch (err) {
      const geoErr = err as GeoError;
      setError(geoErr.message);
    }
  };

  const goOffline = async () => {
    if (!driverId) return;
    try {
      await api.patch(`/drivers/${driverId}/offline`);
    } catch {}
    setIsOnline(false);
    setPendingRides([]);
    clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  };

  const updateLocation = async () => {
    try {
      const pos = await getCurrentLocation();
      setLocation({ lat: pos.lat, lng: pos.lng });
      if (driverId) {
        await api.patch(`/drivers/${driverId}/location`, { lat: pos.lat, lng: pos.lng });
      }
    } catch (err) {
      const geoErr = err as GeoError;
      setError(geoErr.message);
    }
  };

  // Track location in ref so pending rides interval doesn't reset on every GPS update
  const locationRef = useRef(location);
  locationRef.current = location;

  // Live ticking timer for elapsed time display
  useEffect(() => {
    if (!activeRide?.startedAt || activeRide.status !== 'IN_PROGRESS') return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [activeRide?.startedAt, activeRide?.status]);

  // Compute current speed from GPS history
  const computeCurrentSpeed = useCallback((): number => {
    const history = speedHistoryRef.current;
    if (history.length < 2) return 0;
    const recent = history.slice(-5);
    let totalSpeed = 0;
    let count = 0;
    for (let i = 1; i < recent.length; i++) {
      const dt = (recent[i].time - recent[i - 1].time) / 1000;
      if (dt < 1) continue;
      const dist = haversineKm(recent[i - 1].lat, recent[i - 1].lng, recent[i].lat, recent[i].lng);
      totalSpeed += dist / (dt / 3600);
      count++;
    }
    return count > 0 ? totalSpeed / count : 0;
  }, []);

  // Fetch pending rides when online and no active ride
  useEffect(() => {
    if (!isOnline || !location || activeRide) return;
    const fetchPending = async () => {
      try {
        const loc = locationRef.current;
        if (!loc) return;
        const { data } = await api.get('/rides/pending', {
          params: { lat: loc.lat, lng: loc.lng, radius: 2.5, driverId },
        });
        setPendingRides(data.rides || []);
      } catch {
        setPendingRides([]);
      }
    };
    fetchPending();
    const interval = setInterval(fetchPending, 8000);
    return () => clearInterval(interval);
  }, [isOnline, location != null, activeRide, driverId]);

  const acceptRide = async (rideId: string) => {
    if (!driverId) return;
    setLoading(true);
    try {
      await api.post(`/rides/${rideId}/accept`, { driverId });
      setPendingRides([]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to accept ride');
    } finally {
      setLoading(false);
    }
  };

  const submitCounterOffer = async () => {
    if (!driverId || !counterOfferRideId) return;
    const farePesos = parseInt(counterOfferFare);
    if (isNaN(farePesos) || farePesos <= 0) return;
    const fareCentavos = farePesos * 100;
    setLoading(true);
    try {
      await api.post(`/rides/${counterOfferRideId}/counter-offer`, { driverId, fare: fareCentavos });
      setPendingRides((prev) => prev.filter((r) => r.id !== counterOfferRideId));
      setCounterOfferRideId(null);
      setCounterOfferFare('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit counter-offer');
    } finally {
      setLoading(false);
    }
  };

  const declineRide = (rideId: string) => {
    setPendingRides((prev) => prev.filter((r) => r.id !== rideId));
  };

  const updateRideStatus = async (action: 'arriving' | 'start' | 'complete') => {
    if (!activeRide) return;
    setLoading(true);
    try {
      const { data } = await api.post(`/rides/${activeRide.id}/${action}`);
      if (action === 'complete') {
        setFeedbackPassengerName(activeRide.passenger.name);
        setFeedbackRideId(activeRide.id);
        setActiveRide(null);
      } else {
        // Update local state immediately to prevent double-clicks
        setActiveRide((prev) => prev ? { ...prev, status: data.status || (action === 'arriving' ? 'ARRIVING' : 'IN_PROGRESS') } : prev);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${action} ride`);
    } finally {
      setLoading(false);
    }
  };

  const cancelRide = async () => {
    if (!activeRide) return;
    try {
      await api.post(`/rides/${activeRide.id}/cancel`, { reason: 'Cancelled by driver' });
      setActiveRide(null);
    } catch {}
  };

  const submitPassengerFeedback = async (thumbsUp: boolean) => {
    if (!feedbackRideId) return;
    setFeedbackSubmitting(true);
    try {
      await api.post(`/rides/${feedbackRideId}/passenger-feedback`, { thumbsUp });
    } catch {}
    setFeedbackRideId(null);
    setFeedbackPassengerName('');
    setFeedbackSubmitting(false);
  };

  const submitPlatformTip = async () => {
    if (tipAmount < 100) return;
    setTipping(true);
    try {
      const res = await api.post('/tips', {
        amount: tipAmount,
        rideId: feedbackRideId || undefined,
      });
      if (res.data.checkoutUrl) {
        window.location.href = res.data.checkoutUrl;
      } else {
        setTipSuccess(true);
        setShowTipModal(false);
        setTimeout(() => setTipSuccess(false), 3000);
      }
    } catch {} finally { setTipping(false); }
  };

  const mapMarkers = [
    ...(location ? [{ id: 'me', lat: location.lat, lng: location.lng, icon: 'tricycle' as const }] : []),
    ...(activeRide ? [
      { id: 'pickup', lat: activeRide.pickupLat, lng: activeRide.pickupLng, icon: 'pickup' as const, label: 'A' },
      { id: 'dropoff', lat: activeRide.dropoffLat, lng: activeRide.dropoffLng, icon: 'dropoff' as const, label: 'B' },
    ] : pendingRides.slice(0, 5).map((r) => ({
      id: r.id, lat: r.pickupLat, lng: r.pickupLng, icon: 'pickup' as const, label: 'A' }))),
  ];

  // Calculate pickup distance for each pending ride
  const getPickupDistance = (ride: PendingRide): number => {
    if (!location) return 0;
    const R = 6371;
    const dLat = ((ride.pickupLat - location.lat) * Math.PI) / 180;
    const dLng = ((ride.pickupLng - location.lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((location.lat * Math.PI) / 180) * Math.cos((ride.pickupLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const mapCenter: [number, number] = location ? [location.lat, location.lng] : DIGOS_CENTER;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-triq-yellow">Driver Dashboard</h2>
        <div className="flex items-center gap-2">
          {isOnline && (
            <button
              onClick={updateLocation}
              className="px-3 h-9 rounded-lg text-xs font-bold bg-triq-cyan/20 text-triq-cyan border border-triq-cyan/30 active:scale-[0.97] whitespace-nowrap"
            >
              📍 Update
            </button>
          )}
          <button
            onClick={isOnline ? goOffline : goOnline}
            className={`px-4 h-9 rounded-lg text-sm font-bold whitespace-nowrap ${
              isOnline ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}
          >
            {isOnline ? '● Online' : '○ Offline'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Earnings mini-summary (when online, no active ride) */}
      {isOnline && !activeRide && earnings && (
        <div className="flex gap-2">
          <div className="flex-1 bg-triq-slate rounded-lg border border-triq-light/20 p-2.5">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Today</p>
            <p className="text-triq-yellow font-bold text-sm">₱{((earnings.today?.earnings || 0) / 100).toFixed(0)}</p>
            <p className="text-[10px] text-gray-500">{earnings.today?.rides || 0} rides</p>
          </div>
          <div className="flex-1 bg-triq-slate rounded-lg border border-triq-light/20 p-2.5">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">This Week</p>
            <p className="text-triq-yellow font-bold text-sm">₱{((earnings.week?.earnings || 0) / 100).toFixed(0)}</p>
            <p className="text-[10px] text-gray-500">{earnings.week?.rides || 0} rides</p>
          </div>
          <div className="flex-1 bg-triq-slate rounded-lg border border-triq-light/20 p-2.5">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">All Time</p>
            <p className="text-triq-yellow font-bold text-sm">₱{((earnings.total?.earnings || 0) / 100).toFixed(0)}</p>
            <p className="text-[10px] text-gray-500">{earnings.total?.rides || 0} rides</p>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="h-72 rounded-xl overflow-hidden border border-triq-light/20">
        <MapView center={mapCenter} zoom={14} markers={mapMarkers} />
      </div>

      {/* Active ride */}
      {activeRide ? (
        <div className="bg-triq-slate rounded-xl border border-triq-light/20 p-4 space-y-4">
          <h3 className="text-lg font-bold text-white">
            {activeRide.status === 'COUNTER_OFFERED' && 'Waiting for passenger response...'}
            {activeRide.status === 'COUNTER_OFFER_ACCEPTED' && 'Counter-offer accepted! Head to pickup'}
            {activeRide.status === 'ACCEPTED' && 'Heading to pickup'}
            {activeRide.status === 'ARRIVING' && 'Arriving at pickup'}
            {activeRide.status === 'IN_PROGRESS' && 'Ride in progress'}
          </h3>

          {activeRide.status === 'COUNTER_OFFERED' && activeRide.counterOfferedFare && (
            <div className="bg-triq-yellow/10 border border-triq-yellow/30 rounded-lg p-3 flex items-center justify-between">
              <span className="text-xs text-gray-300">Your offer:</span>
              <span className="text-triq-yellow font-bold text-lg">₱{(activeRide.counterOfferedFare / 100).toFixed(0)}</span>
            </div>
          )}

          {activeRide.status === 'IN_PROGRESS' && (() => {
            const dist = location ? haversineKm(location.lat, location.lng, activeRide.dropoffLat, activeRide.dropoffLng) : 0;
            const currentSpeed = computeCurrentSpeed();
            const avgSpeed = currentSpeed > 2 ? currentSpeed : 20;
            const baseEta = Math.max(1, Math.round((dist / avgSpeed) * 60));
            const speedVariance = currentSpeed > 0 ? Math.min(5, Math.max(1, Math.round(60 / Math.max(5, currentSpeed)))) : 3;
            const etaMin = Math.max(1, baseEta - speedVariance);
            const etaMax = baseEta + speedVariance + 2;
            const elapsedMs = activeRide.startedAt ? Date.now() - new Date(activeRide.startedAt).getTime() : 0;
            const showReminder = elapsedMs / 60000 >= baseEta;
            return (
              <div className="space-y-2">
                <div className="bg-triq-cyan/10 border border-triq-cyan/30 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-300">Estimated arrival</p>
                    <p className="text-triq-cyan font-bold text-lg">{etaMin}–{etaMax} min</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">{dist.toFixed(2)} km to dropoff</p>
                    <p className="text-xs text-gray-500 font-mono">{formatElapsed(elapsedMs)} elapsed</p>
                    {currentSpeed > 0 && <p className="text-xs text-gray-600">{Math.round(currentSpeed)} km/h</p>}
                  </div>
                </div>
                {showReminder && (
                  <div className="bg-triq-yellow/10 border border-triq-yellow/30 rounded-lg p-3">
                    <p className="text-triq-yellow text-sm font-semibold">📍 You should be near the drop-off. Tap "Complete Ride" after dropping off the passenger.</p>
                  </div>
                )}
              </div>
            );
          })()}

          {activeRide.status !== 'COUNTER_OFFERED' && (
            <>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
              <div>
                <p className="text-gray-400 text-xs">Pickup</p>
                <p className="text-white">{activeRide.pickupAddress}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5" />
              <div>
                <p className="text-gray-400 text-xs">Dropoff</p>
                <p className="text-white">{activeRide.dropoffAddress}</p>
              </div>
            </div>
          </div>

          <div className="bg-triq-dark rounded-lg p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-triq-cyan/20 flex items-center justify-center text-triq-cyan font-bold">
              {activeRide.passenger.name.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">{activeRide.passenger.name}</p>
              <p className="text-gray-400 text-xs">{activeRide.passenger.user.phoneNumber}</p>
            </div>
            <a
              href={`tel:${activeRide.passenger.user.phoneNumber}`}
              className="shrink-0 w-9 h-9 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 flex items-center justify-center active:scale-90"
              title="Call passenger"
            >
              <Phone size={16} />
            </a>
            {activeRide.negotiatedFare ? (
              <div className="text-right">
                <span className="text-gray-500 line-through text-xs">₱{(activeRide.estimatedFare / 100).toFixed(0)}</span>
                <span className="text-triq-yellow font-bold ml-1">₱{(activeRide.negotiatedFare / 100).toFixed(0)}</span>
              </div>
            ) : (
              <span className="text-triq-yellow font-bold">₱{(activeRide.estimatedFare / 100).toFixed(0)}</span>
            )}
          </div>

          <div className="flex gap-2">
            {(activeRide.status === 'ACCEPTED' || activeRide.status === 'COUNTER_OFFER_ACCEPTED') && (
              <button
                onClick={() => updateRideStatus('arriving')}
                disabled={loading}
                className="flex-1 h-11 rounded-lg bg-triq-cyan text-triq-dark font-bold text-sm active:scale-[0.97]"
              >
                I'm Arriving
              </button>
            )}
            {(activeRide.status === 'ACCEPTED' || activeRide.status === 'COUNTER_OFFER_ACCEPTED' || activeRide.status === 'ARRIVING') && (
              <button
                onClick={() => updateRideStatus('start')}
                disabled={loading}
                className="flex-1 h-11 rounded-lg bg-triq-yellow text-triq-dark font-bold text-sm active:scale-[0.97]"
              >
                Start Ride
              </button>
            )}
            {activeRide.status === 'IN_PROGRESS' && (
              <button
                onClick={() => updateRideStatus('complete')}
                disabled={loading}
                className="flex-1 h-11 rounded-lg bg-green-500 text-white font-bold text-sm active:scale-[0.97]"
              >
                Complete Ride
              </button>
            )}
            <button
              onClick={cancelRide}
              className="h-11 px-4 rounded-lg border border-red-500/30 text-red-400 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
            </>
          )}
        </div>
      ) : isOnline ? (
        /* Pending ride requests */
        pendingRides.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-400">{pendingRides.length} ride request{pendingRides.length > 1 ? 's' : ''} nearby</p>
            {pendingRides.map((ride) => (
              <RideRequestCard
                key={ride.id}
                ride={ride}
                pickupDistance={getPickupDistance(ride)}
                onAccept={() => acceptRide(ride.id)}
                onDecline={() => declineRide(ride.id)}
                onCounterOffer={() => { setCounterOfferRideId(ride.id); setCounterOfferFare(((ride.estimatedFare) / 100).toFixed(0)); }}
                loading={loading}
              />
            ))}

            {/* Counter-offer modal */}
            {counterOfferRideId && (
              <div className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center p-4" onClick={() => setCounterOfferRideId(null)}>
                <div className="bg-triq-slate rounded-xl border border-triq-light/30 p-4 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold text-lg">Counter-Offer</h3>
                    <button onClick={() => setCounterOfferRideId(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
                  </div>
                  <p className="text-xs text-gray-400">Propose a different fare to the passenger. They have 5 minutes to respond.</p>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-xl">₱</span>
                    <input
                      type="number"
                      value={counterOfferFare}
                      onChange={(e) => setCounterOfferFare(e.target.value)}
                      className="flex-1 h-12 px-3 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-lg font-bold"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={submitCounterOffer}
                    disabled={loading}
                    className="w-full h-11 rounded-lg bg-triq-yellow text-triq-dark font-bold text-sm active:scale-[0.97] disabled:opacity-40"
                  >
                    {loading ? 'Sending...' : 'Send Counter-Offer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-triq-slate rounded-xl border border-triq-light/20 p-6 text-center">
            <div className="inline-block w-6 h-6 border-2 border-triq-cyan/30 border-t-triq-cyan rounded-full animate-spin mb-2" />
            <p className="text-white font-semibold">Waiting for ride requests...</p>
            <p className="text-gray-400 text-sm mt-1">You're online and visible to nearby passengers</p>
          </div>
        )
      ) : (
        <div className="bg-triq-slate rounded-xl border border-triq-light/20 p-6 text-center">
          <p className="text-white font-semibold">You're offline</p>
          <p className="text-gray-400 text-sm mt-1">Go online to start receiving ride requests</p>
        </div>
      )}

      {/* Passenger feedback modal — shown after completing a ride */}
      {feedbackRideId && (
        <div className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center p-4" onClick={() => !feedbackSubmitting && setFeedbackRideId(null)}>
          <div className="bg-triq-slate rounded-xl border border-triq-light/30 p-5 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Rate your passenger</h3>
              <button onClick={() => !feedbackSubmitting && setFeedbackRideId(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-400">How was your ride with <span className="text-white font-semibold">{feedbackPassengerName}</span>?</p>
            <div className="flex gap-3">
              <button
                onClick={() => submitPassengerFeedback(true)}
                disabled={feedbackSubmitting}
                className="flex-1 h-16 rounded-lg bg-green-500/15 text-green-400 border border-green-500/30 flex flex-col items-center justify-center gap-1 active:scale-95 disabled:opacity-40"
              >
                <ThumbsUp size={24} />
                <span className="text-xs font-medium">Good Passenger</span>
              </button>
              <button
                onClick={() => submitPassengerFeedback(false)}
                disabled={feedbackSubmitting}
                className="flex-1 h-16 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 flex flex-col items-center justify-center gap-1 active:scale-95 disabled:opacity-40"
              >
                <ThumbsDown size={24} />
                <span className="text-xs font-medium">Bad Experience</span>
              </button>
            </div>
            <button
              onClick={() => setFeedbackRideId(null)}
              disabled={feedbackSubmitting}
              className="w-full text-center text-xs text-gray-500 hover:text-gray-400"
            >
              Skip
            </button>
            {!tipSuccess && (
              <button
                onClick={() => setShowTipModal(true)}
                className="w-full h-10 rounded-lg bg-triq-cyan/10 text-triq-cyan border border-triq-cyan/30 text-sm font-medium flex items-center justify-center gap-1.5"
              >
                <Heart size={14} />
                Tip TriQ Platform
              </button>
            )}
            {tipSuccess && (
              <div className="w-full h-10 rounded-lg bg-green-500/10 text-green-400 text-sm font-medium flex items-center justify-center gap-1.5">
                <Heart size={14} /> Tip Created!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Platform tip modal */}
      {showTipModal && (
        <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowTipModal(false)}>
          <div className="bg-triq-slate rounded-xl border border-triq-light/30 p-5 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Heart size={18} className="text-triq-cyan" /> Tip TriQ
              </h3>
              <button onClick={() => setShowTipModal(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-400">Support the platform with a small tip. Pay via GCash, Maya, or card.</p>
            <div className="flex gap-2 flex-wrap">
              {[1000, 2000, 5000, 10000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => { setTipAmount(amt); setTipCustom(''); }}
                  className={`px-3 h-9 rounded-lg text-sm font-medium transition-all active:scale-90 ${
                    tipAmount === amt && !tipCustom
                      ? 'bg-triq-cyan text-triq-dark'
                      : 'bg-triq-light/10 text-gray-400 hover:bg-triq-light/20'
                  }`}
                >
                  ₱{(amt / 100).toFixed(0)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">₱</span>
              <input
                type="number"
                min="1"
                value={tipCustom}
                onChange={(e) => {
                  setTipCustom(e.target.value);
                  const parsed = parseInt(e.target.value) || 0;
                  setTipAmount(parsed > 0 ? parsed * 100 : 0);
                }}
                placeholder="Custom amount"
                className="flex-1 h-9 px-3 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm"
              />
            </div>
            <button
              onClick={submitPlatformTip}
              disabled={tipping || tipAmount < 100}
              className="w-full h-10 rounded-lg bg-triq-cyan text-triq-dark font-bold text-sm disabled:opacity-40"
            >
              {tipping ? 'Processing...' : `Tip ₱${(tipAmount / 100).toFixed(0)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RideRequestCard({
  ride,
  pickupDistance,
  onAccept,
  onDecline,
  onCounterOffer,
  loading,
}: {
  ride: PendingRide;
  pickupDistance: number;
  onAccept: () => void;
  onDecline: () => void;
  onCounterOffer: () => void;
  loading: boolean;
}) {
  const fare = ride.estimatedFare / 100;
  const longPickup = pickupDistance > 1.5;
  return (
    <div className="bg-triq-slate rounded-xl border border-triq-yellow/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-triq-yellow font-bold text-lg">₱{fare.toFixed(0)}</span>
          <span className="text-xs text-gray-400 flex items-center gap-0.5">
            <Navigation size={10} className="text-triq-cyan" />
            {pickupDistance.toFixed(1)}km
          </span>
          {ride.preferredDriverId && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-triq-cyan/20 text-triq-cyan font-medium">REBOOK</span>
          )}
        </div>
        <span className="text-xs text-gray-400">{ride.passengerCount} passenger{ride.passengerCount > 1 ? 's' : ''}</span>
      </div>
      {longPickup && (
        <p className="text-[11px] text-orange-400 bg-orange-500/10 rounded px-2 py-1">
          Long pickup — driver may ask for additional fare
        </p>
      )}
      <div className="space-y-1 text-sm">
        <p className="text-gray-400 text-xs">From: <span className="text-white">{ride.pickupAddress}</span></p>
        <p className="text-gray-400 text-xs">To: <span className="text-white">{ride.dropoffAddress}</span></p>
      </div>
      {(ride.hasSeniorCitizen || ride.hasStudent || ride.hasExtraBaggage) && (
        <div className="flex gap-1.5">
          {ride.hasSeniorCitizen && <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">Senior</span>}
          {ride.hasStudent && <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">Student</span>}
          {ride.hasExtraBaggage && <span className="text-xs px-2 py-0.5 rounded bg-orange-500/20 text-orange-300">Baggage</span>}
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={onAccept}
          disabled={loading}
          className="flex-1 h-10 rounded-lg bg-green-500 text-white font-bold text-sm active:scale-[0.97]"
        >
          Accept
        </button>
        <button
          onClick={onCounterOffer}
          disabled={loading}
          className="h-10 px-3 rounded-lg bg-triq-yellow/20 text-triq-yellow text-sm font-bold border border-triq-yellow/30 active:scale-[0.97]"
        >
          Counter
        </button>
        {ride.passenger.user?.phoneNumber && (
          <a
            href={`tel:${ride.passenger.user.phoneNumber}`}
            className="h-10 w-10 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 flex items-center justify-center active:scale-90 shrink-0"
            title="Call passenger"
          >
            <Phone size={16} />
          </a>
        )}
        <button
          onClick={onDecline}
          className="h-10 px-3 rounded-lg border border-triq-light/30 text-gray-400 text-sm font-medium"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
