import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Users, Car, Wifi, Activity, CalendarCheck, CheckCircle, Coins, ShieldAlert, Ban, TrendingUp, Heart, CreditCard, Gift, Crown } from 'lucide-react';

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
  eliteSubscriptions: number;
  adminGrantedVips: number;
  paidSubscriptions: number;
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
    { label: 'Total Passengers', value: stats.totalPassengers, color: 'text-triq-cyan', icon: Users, bg: 'bg-triq-cyan/10' },
    { label: 'Total Drivers', value: stats.totalDrivers, color: 'text-triq-yellow', icon: Car, bg: 'bg-triq-yellow/10' },
    { label: 'Online Now', value: stats.onlineDrivers, color: 'text-green-400', icon: Wifi, bg: 'bg-green-500/10' },
    { label: 'Active Rides', value: stats.activeRides, color: 'text-orange-400', icon: Activity, bg: 'bg-orange-500/10' },
    { label: "Today's Rides", value: stats.todayRides, color: 'text-blue-400', icon: CalendarCheck, bg: 'bg-blue-500/10' },
    { label: 'Completed', value: stats.completedRides, color: 'text-green-400', icon: CheckCircle, bg: 'bg-green-500/10' },
    { label: 'Total Fares', value: formatPeso(stats.totalFares), color: 'text-triq-yellow', icon: Coins, bg: 'bg-triq-yellow/10' },
    { label: 'Pending KYC', value: stats.pendingKyc, color: 'text-purple-400', icon: ShieldAlert, bg: 'bg-purple-500/10' },
    { label: 'Suspended', value: stats.suspendedDrivers, color: 'text-red-400', icon: Ban, bg: 'bg-red-500/10' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-triq-yellow">Dashboard</h1>
        <span className="text-xs text-gray-500">Auto-refreshes every 30s</span>
      </div>

      {/* Platform revenue breakdown */}
      <div className="bg-gradient-to-br from-triq-slate to-triq-dark rounded-xl border border-triq-yellow/20 p-5 sm:p-6 space-y-4 shadow-card">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-triq-yellow" />
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Platform Revenue</p>
        </div>
        <p className="text-3xl sm:text-4xl font-bold text-triq-yellow">{formatPeso(stats.totalPlatformRevenue)}</p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2.5 bg-triq-dark/50 rounded-lg p-3 border border-triq-light/10">
            <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
              <CreditCard size={16} className="text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">Subscriptions</p>
              <p className="text-green-400 font-semibold">{formatPeso(stats.subscriptionRevenue)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-triq-dark/50 rounded-lg p-3 border border-triq-light/10">
            <div className="w-9 h-9 rounded-lg bg-triq-cyan/10 flex items-center justify-center shrink-0">
              <Heart size={16} className="text-triq-cyan" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">Tips</p>
              <p className="text-triq-cyan font-semibold">{formatPeso(stats.tipRevenue)}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500 pt-3 border-t border-triq-light/10">
          <span>Paid Subs: <span className="text-white font-bold">{stats.paidSubscriptions}</span></span>
          <span>PRO: <span className="text-triq-cyan font-bold">{stats.proSubscriptions}</span></span>
          <span>ELITE: <span className="text-triq-yellow font-bold">{stats.eliteSubscriptions}</span></span>
          <span>Completed Rides: <span className="text-white font-bold">{stats.completedRides}</span></span>
        </div>
      </div>

      {/* Admin-granted VIPs — separate from paid revenue */}
      <div className="bg-gradient-to-br from-triq-slate to-triq-dark rounded-xl border border-triq-yellow/20 p-4 space-y-3 shadow-card">
        <div className="flex items-center gap-2">
          <Gift size={16} className="text-triq-yellow" />
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Admin-Granted VIP</p>
          <span className="ml-auto text-xs text-gray-500">Not counted in revenue</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-triq-dark/60 rounded-lg p-3 border border-triq-light/10 text-center">
            <p className="text-2xl font-bold text-triq-yellow">{stats.adminGrantedVips}</p>
            <p className="text-xs text-gray-400 mt-0.5">Active Grants</p>
          </div>
          <div className="bg-triq-dark/60 rounded-lg p-3 border border-triq-cyan/10 text-center">
            <Crown size={14} className="text-triq-cyan mx-auto mb-1" />
            <p className="text-xs text-gray-400">PRO grants</p>
            <p className="text-sm font-bold text-triq-cyan">{stats.proSubscriptions}</p>
          </div>
          <div className="bg-triq-dark/60 rounded-lg p-3 border border-triq-yellow/10 text-center">
            <Crown size={14} className="text-triq-yellow mx-auto mb-1" />
            <p className="text-xs text-gray-400">ELITE grants</p>
            <p className="text-sm font-bold text-triq-yellow">{stats.eliteSubscriptions}</p>
          </div>
        </div>
        <p className="text-xs text-gray-600">Grant free VIP from Subscriptions → Grant Free VIP section</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-triq-slate rounded-xl border border-triq-light/20 p-4 hover:border-triq-light/40 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center`}>
                  <Icon size={17} className={card.color} />
                </div>
              </div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">{card.label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${card.color}`}>{card.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
