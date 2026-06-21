import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../lib/api';
import { Phone, Car, Star, Shield, Bike, MapPin } from 'lucide-react';

interface DriverData {
  id: string;
  name: string;
  plateNumber: string;
  tricycleModel: string | null;
  photoUrl: string | null;
  rating: number;
  reviewCount: number;
  totalRides: number;
  totalEarnings: number;
  isOnline: boolean;
  status: string;
  kycStatus: string;
  pickupRadius: number;
  subscriptionTier: string;
}

export default function DriverProfile() {
  const { user } = useAuthStore();
  const [driver, setDriver] = useState<DriverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [radius, setRadius] = useState(2.0);
  const [savingRadius, setSavingRadius] = useState(false);
  const [radiusSaved, setRadiusSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.get('/drivers', { params: { userId: user.id } })
      .then((res) => {
        setDriver(res.data);
        setRadius(res.data.pickupRadius || 2.0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const saveRadius = async () => {
    if (!driver) return;
    setSavingRadius(true);
    try {
      await api.patch(`/drivers/${driver.id}/radius`, { radius });
      setRadiusSaved(true);
      setTimeout(() => setRadiusSaved(false), 2000);
    } catch {} finally {
      setSavingRadius(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-8 h-8 border-2 border-triq-cyan/30 border-t-triq-cyan rounded-full animate-spin" />
      </div>
    );
  }

  const kycColor = driver?.kycStatus === 'VERIFIED' ? 'text-green-400' : driver?.kycStatus === 'REJECTED' ? 'text-red-400' : 'text-yellow-400';
  const kycLabel = driver?.kycStatus === 'VERIFIED' ? 'Verified' : driver?.kycStatus === 'REJECTED' ? 'Rejected' : 'Pending Review';

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-triq-yellow">Driver Profile</h2>

      <div className="card p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-triq-yellow/20 flex items-center justify-center text-triq-yellow font-bold text-2xl">
          {driver?.name?.charAt(0) || user?.phoneNumber?.charAt(user.phoneNumber.length - 1) || '?'}
        </div>
        <div>
          <p className="text-white font-semibold text-lg">{driver?.name || user?.phoneNumber || 'Unknown'}</p>
          <p className="text-gray-400 text-sm">Driver · {driver?.subscriptionTier || 'FREE'}</p>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Phone size={18} className="text-triq-cyan" />
          <div>
            <p className="text-xs text-gray-400">Phone</p>
            <p className="text-white text-sm">{user?.phoneNumber || 'Not set'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Bike size={18} className="text-triq-cyan" />
          <div>
            <p className="text-xs text-gray-400">Vehicle</p>
            <p className="text-white text-sm">{driver?.tricycleModel || 'Tricycle'} · {driver?.plateNumber || 'No plate'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Star size={18} className="text-triq-cyan" />
          <div>
            <p className="text-xs text-gray-400">Rating</p>
            <p className="text-white text-sm">{driver && driver.rating > 0 ? `${driver.rating.toFixed(1)} (${driver.totalRides} rides)` : 'No ratings yet'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Shield size={18} className="text-triq-cyan" />
          <div>
            <p className="text-xs text-gray-400">KYC Status</p>
            <p className={`text-sm ${kycColor}`}>{kycLabel}</p>
          </div>
        </div>
        {driver?.status && (
          <div className="flex items-center gap-3">
            <Car size={18} className="text-triq-cyan" />
            <div>
              <p className="text-xs text-gray-400">Driver Status</p>
              <p className="text-white text-sm">{driver.status}</p>
            </div>
          </div>
        )}
      </div>

      {/* Pickup radius setting */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-triq-cyan" />
          <h3 className="text-sm font-semibold text-white">Pickup Radius</h3>
        </div>
        <p className="text-xs text-gray-400">Set how far you're willing to travel to pick up a passenger.</p>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0.5"
            max="20"
            step="0.5"
            value={radius}
            onChange={(e) => setRadius(parseFloat(e.target.value))}
            className="flex-1 accent-triq-cyan"
          />
          <span className="text-triq-yellow font-bold text-sm w-16 text-right">{radius.toFixed(1)} km</span>
        </div>
        <button
          onClick={saveRadius}
          disabled={savingRadius}
          className="w-full h-9 rounded-lg bg-triq-cyan text-triq-dark font-bold text-sm disabled:opacity-40"
        >
          {savingRadius ? 'Saving...' : radiusSaved ? 'Saved!' : 'Save Radius'}
        </button>
      </div>
    </div>
  );
}
