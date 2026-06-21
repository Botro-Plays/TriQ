import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../lib/api';
import { TrendingUp, Calendar, DollarSign, Star, Info } from 'lucide-react';

interface EarningsData {
  today: { earnings: number; rides: number };
  week: { earnings: number; rides: number };
  month: { earnings: number; rides: number };
  total: { earnings: number; rides: number };
}

interface DriverProfile {
  rating: number;
  totalRides: number;
  plateNumber: string;
  tricycleModel: string | null;
}

export default function DriverEarnings() {
  const { user } = useAuthStore();
  const [data, setData] = useState<EarningsData | null>(null);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api.get('/drivers', { params: { userId: user.id } })
      .then((res) => {
        setProfile(res.data);
        return api.get(`/drivers/${res.data.id}/earnings`);
      })
      .then((res) => setData(res.data))
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
    </div>
  );
}
