import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../lib/api';
import MapView from '../../components/MapView';
import { getCurrentLocation, watchLocation, clearWatch, type GeoError } from '../../lib/geolocation';

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
  passenger: { name: string };
}

interface ActiveRide {
  id: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  estimatedFare: number;
  passenger: { id: string; name: string; user: { phoneNumber: string } };
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
  const watchIdRef = useRef<number | null>(null);
  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get driver profile
  useEffect(() => {
    if (!user) return;
    api.get('/drivers', { params: { userId: user.id } })
      .then((res) => {
        setDriverId(res.data.id);
        setIsOnline(res.data.isOnline);
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

      // Start watching position
      const watchId = watchLocation(
        (p) => {
          setLocation({ lat: p.lat, lng: p.lng });
        },
        (err: GeoError) => {
          if (err.code === 'PERMISSION_DENIED') {
            setError('Location permission was denied. Please enable location services to stay online.');
            goOffline();
          }
        }
      );
      watchIdRef.current = watchId;

      // Send location updates every 15s
      locationIntervalRef.current = setInterval(async () => {
        try {
          const pos = await getCurrentLocation();
          await api.patch(`/drivers/${driverId}/location`, {
            lat: pos.lat,
            lng: pos.lng,
          });
        } catch {}
      }, 15000);
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

  // Fetch pending rides when online and no active ride
  useEffect(() => {
    if (!isOnline || !location || activeRide) return;
    const fetchPending = async () => {
      try {
        // For now, fetch all requested rides — in production this would be via Socket.io
        const { data } = await api.get('/rides/pending', {
          params: { lat: location.lat, lng: location.lng, radius: 5 },
        });
        setPendingRides(data.rides || []);
      } catch {
        setPendingRides([]);
      }
    };
    fetchPending();
    const interval = setInterval(fetchPending, 8000);
    return () => clearInterval(interval);
  }, [isOnline, location, activeRide]);

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

  const declineRide = (rideId: string) => {
    setPendingRides((prev) => prev.filter((r) => r.id !== rideId));
  };

  const updateRideStatus = async (action: 'arriving' | 'start' | 'complete') => {
    if (!activeRide) return;
    setLoading(true);
    try {
      await api.post(`/rides/${activeRide.id}/${action}`);
      if (action === 'complete') {
        setActiveRide(null);
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

  const mapMarkers = [
    ...(location ? [{ id: 'me', lat: location.lat, lng: location.lng, icon: 'driver' as const }] : []),
    ...pendingRides.slice(0, 5).map((r) => ({
      id: r.id,
      lat: r.pickupLat,
      lng: r.pickupLng,
      icon: 'pickup' as const,
    })),
  ];

  const mapCenter: [number, number] = location ? [location.lat, location.lng] : DIGOS_CENTER;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-triq-yellow">Driver Dashboard</h2>
        <button
          onClick={isOnline ? goOffline : goOnline}
          className={`px-4 h-9 rounded-lg text-sm font-bold ${
            isOnline ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}
        >
          {isOnline ? '● Online' : '○ Offline'}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <p className="text-red-400 text-sm">{error}</p>
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
            {activeRide.status === 'ACCEPTED' && 'Heading to pickup'}
            {activeRide.status === 'ARRIVING' && 'Arriving at pickup'}
            {activeRide.status === 'IN_PROGRESS' && 'Ride in progress'}
          </h3>

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
            <span className="text-triq-yellow font-bold">₱{(activeRide.estimatedFare / 100).toFixed(0)}</span>
          </div>

          <div className="flex gap-2">
            {activeRide.status === 'ACCEPTED' && (
              <button
                onClick={() => updateRideStatus('arriving')}
                disabled={loading}
                className="flex-1 h-11 rounded-lg bg-triq-cyan text-triq-dark font-bold text-sm active:scale-[0.97]"
              >
                I'm Arriving
              </button>
            )}
            {(activeRide.status === 'ACCEPTED' || activeRide.status === 'ARRIVING') && (
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
                onAccept={() => acceptRide(ride.id)}
                onDecline={() => declineRide(ride.id)}
                loading={loading}
              />
            ))}
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
    </div>
  );
}

function RideRequestCard({
  ride,
  onAccept,
  onDecline,
  loading,
}: {
  ride: PendingRide;
  onAccept: () => void;
  onDecline: () => void;
  loading: boolean;
}) {
  const fare = ride.estimatedFare / 100;
  return (
    <div className="bg-triq-slate rounded-xl border border-triq-yellow/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-triq-yellow font-bold text-lg">₱{fare.toFixed(0)}</span>
        <span className="text-xs text-gray-400">{ride.passengerCount} passenger{ride.passengerCount > 1 ? 's' : ''}</span>
      </div>
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
          onClick={onDecline}
          className="h-10 px-4 rounded-lg border border-triq-light/30 text-gray-400 text-sm font-medium"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
