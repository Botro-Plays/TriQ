import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

interface Stats {
  totalPassengers: number;
  totalDrivers: number;
  onlineDrivers: number;
  totalRides: number;
  activeRides: number;
  todayRides: number;
  completedRides: number;
  pendingKyc: number;
  suspendedDrivers: number;
  subscriptionRevenue: number;
  tipRevenue: number;
  totalPlatformRevenue: number;
  activeSubscriptions: number;
  proSubscriptions: number;
  totalFares: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = () => {
      api.get('/admin/stats/overview')
        .then((res) => setStats(res.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-8 h-8 border-2 border-triq-cyan/30 border-t-triq-cyan rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return <p className="text-red-400">Failed to load stats</p>;
  }

  const formatPeso = (centavos: number) => `₱${(centavos / 100).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

  const cards = [
    { label: 'Total Passengers', value: stats.totalPassengers, color: 'text-triq-cyan' },
    { label: 'Total Drivers', value: stats.totalDrivers, color: 'text-triq-yellow' },
    { label: 'Online Now', value: stats.onlineDrivers, color: 'text-green-400' },
    { label: 'Active Rides', value: stats.activeRides, color: 'text-orange-400' },
    { label: 'Today\'s Rides', value: stats.todayRides, color: 'text-blue-400' },
    { label: 'Completed', value: stats.completedRides, color: 'text-green-400' },
    { label: 'Total Fares', value: formatPeso(stats.totalFares), color: 'text-triq-yellow' },
    { label: 'Pending KYC', value: stats.pendingKyc, color: 'text-purple-400' },
    { label: 'Suspended', value: stats.suspendedDrivers, color: 'text-red-400' },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-triq-yellow">Dashboard</h1>

      {/* Platform revenue breakdown */}
      <div className="bg-gradient-to-r from-triq-slate to-triq-dark rounded-xl border border-triq-yellow/20 p-5 space-y-3">
        <p className="text-xs text-gray-400 uppercase tracking-wider">Platform Revenue</p>
        <p className="text-3xl font-bold text-triq-yellow">{formatPeso(stats.totalPlatformRevenue)}</p>
        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-gray-400">Subscriptions: </span>
            <span className="text-green-400 font-semibold">{formatPeso(stats.subscriptionRevenue)}</span>
          </div>
          <div>
            <span className="text-gray-400">Tips: </span>
            <span className="text-triq-cyan font-semibold">{formatPeso(stats.tipRevenue)}</span>
          </div>
        </div>
        <div className="flex gap-4 text-xs text-gray-500 pt-1 border-t border-triq-light/10">
          <span>Active Subs: <span className="text-white font-bold">{stats.activeSubscriptions}</span></span>
          <span>Pro: <span className="text-white font-bold">{stats.proSubscriptions}</span></span>
          <span>Completed Rides: <span className="text-white font-bold">{stats.completedRides}</span></span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div key={card.label} className="bg-triq-slate rounded-xl border border-triq-light/20 p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
