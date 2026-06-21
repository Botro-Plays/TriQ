import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../lib/api';
import { Phone, Car, Star, Shield, Bike } from 'lucide-react';

interface DriverData {
  name: string;
  plateNumber: string;
  tricycleModel: string | null;
  photoUrl: string | null;
  rating: number;
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

  useEffect(() => {
    if (!user) return;
    api.get('/drivers', { params: { userId: user.id } })
      .then((res) => setDriver(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

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
    </div>
  );
}
