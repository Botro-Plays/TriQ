import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../lib/api';
import { TrendingUp, Calendar, DollarSign, Star, Info, MapPin, Navigation } from 'lucide-react';

interface EarningsData {
  today: { earnings: number; rides: number };
  week: { earnings: number; rides: number };
  month: { earnings: number; rides: number };
  total: { earnings: number; rides: number };
}

interface DriverProfile {
  id: string;
  rating: number;
  totalRides: number;
  plateNumber: string;
  tricycleModel: string | null;
}

interface RideAuditItem {
  id: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  estimatedFare: number;
  finalFare: number | null;
  createdAt: string;
  completedAt: string | null;
  passenger: { name: string };
}

export default function DriverEarnings() {
  const { user } = useAuthStore();
  const [data, setData] = useState<EarningsData | null>(null);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [rides, setRides] = useState<RideAuditItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api.get('/drivers', { params: { userId: user.id } })
      .then((res) => {
        setProfile(res.data);
        return Promise.all([
          api.get(`/drivers/${res.data.id}/earnings`),
          api.get(`/drivers/${res.data.id}/rides`),
        ]);
      })
      .then(([earningsRes, ridesRes]) => {
        setData(earningsRes.data);
        setRides(ridesRes.data.rides);
      })
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

  const formatPeso = (centavos: number) => `₱${(centavos / 100).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

  const cards = [
    { label: 'Today', icon: Calendar, earnings: data?.today?.earnings || 0, rides: data?.today?.rides || 0 },
    { label: 'This Week', icon: TrendingUp, earnings: data?.week?.earnings || 0, rides: data?.week?.rides || 0 },
    { label: 'This Month', icon: DollarSign, earnings: data?.month?.earnings || 0, rides: data?.month?.rides || 0 },
    { label: 'All Time', icon: Star, earnings: data?.total?.earnings || 0, rides: data?.total?.rides || 0 },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-triq-yellow">Earnings</h2>

      {/* Disclaimer banner */}
      <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
        <Info size={14} className="text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-300">Estimated fares shown. Actual cash collection may vary. Platform does not handle ride payments.</p>
      </div>

      <div className="space-y-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card p-4">
              <div className="flex items-center gap-3 mb-2">
                <Icon size={18} className="text-triq-cyan" />
                <p className="text-xs text-gray-400 uppercase tracking-wider">{card.label}</p>
              </div>
              <p className="text-2xl font-bold text-triq-yellow">{formatPeso(card.earnings)}</p>
              <p className="text-sm text-gray-400 mt-0.5">{card.rides} rides</p>
            </div>
          );
        })}
      </div>

      {/* Rating card */}
      {profile && (
        <div className="card p-4 flex items-center gap-4">
          <Star size={28} className="text-triq-yellow" />
          <div>
            <p className="text-white font-bold text-lg">{profile.rating > 0 ? `${profile.rating.toFixed(1)} / 5.0` : 'No ratings yet'}</p>
            <p className="text-xs text-gray-400">{profile.totalRides} total rides</p>
          </div>
        </div>
      )}

      {/* Ride audit list */}
      {rides.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Recent Rides</h3>
          {rides.slice(0, 10).map((ride) => (
            <div key={ride.id} className="card p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  ride.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' :
                  ride.status === 'CANCELLED' ? 'bg-red-500/20 text-red-400' :
                  'bg-triq-cyan/20 text-triq-cyan'
                }`}>{ride.status}</span>
                <span className="text-triq-yellow font-bold text-sm">₱{((ride.finalFare || ride.estimatedFare) / 100).toFixed(0)}</span>
              </div>
              <div className="flex items-start gap-1 text-xs text-gray-400">
                <MapPin size={10} className="text-green-400 mt-0.5 shrink-0" />
                <span className="truncate">{ride.pickupAddress}</span>
              </div>
              <div className="flex items-start gap-1 text-xs text-gray-400">
                <Navigation size={10} className="text-red-400 mt-0.5 shrink-0" />
                <span className="truncate">{ride.dropoffAddress}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-500">
                <span>{ride.passenger.name}</span>
                <span>{ride.completedAt ? new Date(ride.completedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : new Date(ride.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
