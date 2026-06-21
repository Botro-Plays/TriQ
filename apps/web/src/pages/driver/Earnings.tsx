import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { TrendingUp, Calendar, DollarSign } from 'lucide-react';

interface EarningsData {
  totalEarnings: number;
  totalRides: number;
  todayEarnings: number;
  todayRides: number;
  weekEarnings: number;
  weekRides: number;
}

export default function DriverEarnings() {
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/drivers/earnings')
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-8 h-8 border-2 border-triq-cyan/30 border-t-triq-cyan rounded-full animate-spin" />
      </div>
    );
  }

  const formatPeso = (centavos: number) => `₱${(centavos / 100).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

  const cards = [
    { label: 'Today', icon: Calendar, earnings: data?.todayEarnings || 0, rides: data?.todayRides || 0 },
    { label: 'This Week', icon: TrendingUp, earnings: data?.weekEarnings || 0, rides: data?.weekRides || 0 },
    { label: 'All Time', icon: DollarSign, earnings: data?.totalEarnings || 0, rides: data?.totalRides || 0 },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-triq-yellow">Earnings</h2>

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
    </div>
  );
}
