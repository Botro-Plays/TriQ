import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Trophy, Star, Coins, Heart, TrendingUp } from 'lucide-react';

interface LeaderboardEntry {
  id: string;
  name: string;
  photoUrl?: string | null;
  rank: number;
  score: number;
  plateNumber?: string;
  rating?: number;
  totalRides?: number;
  subscriptionTier?: string;
  trustScore?: number;
  tipCount?: number;
  reviewCount?: number;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  total: number;
  page: number;
  pages: number;
}

type Role = 'drivers' | 'passengers';

const DRIVER_METRICS = [
  { key: 'rides', label: 'Rides', icon: TrendingUp },
  { key: 'earnings', label: 'Earnings', icon: Coins },
  { key: 'rating', label: 'Rating', icon: Star },
];

const PASSENGER_METRICS = [
  { key: 'rides', label: 'Rides', icon: TrendingUp },
  { key: 'tips', label: 'Tips', icon: Heart },
  { key: 'ratings', label: 'Avg Rating', icon: Star },
];

const PERIODS = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'alltime', label: 'All Time' },
];

export default function Leaderboard({ role }: { role: Role }) {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week');
  const [metric, setMetric] = useState('rides');
  const [page, setPage] = useState(1);

  const metrics = role === 'drivers' ? DRIVER_METRICS : PASSENGER_METRICS;

  useEffect(() => {
    setLoading(true);
    api.get(`/leaderboards/${role}`, { params: { period, metric, page } })
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [role, period, metric, page]);

  const formatScore = (score: number, metric: string) => {
    if (metric === 'earnings' || metric === 'tips') return `₱${(score / 100).toFixed(0)}`;
    if (metric === 'rating' || metric === 'ratings') return score.toFixed(1);
    return String(score);
  };

  const rankColors = (rank: number) => {
    if (rank === 1) return 'text-yellow-400';
    if (rank === 2) return 'text-gray-300';
    if (rank === 3) return 'text-orange-400';
    return 'text-gray-500';
  };

  const rankBg = (rank: number) => {
    if (rank === 1) return 'border-yellow-400/30 bg-yellow-400/5';
    if (rank === 2) return 'border-gray-300/20 bg-gray-300/5';
    if (rank === 3) return 'border-orange-400/20 bg-orange-400/5';
    return 'border-triq-light/20';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Trophy size={24} className="text-triq-yellow" />
        <h1 className="text-2xl font-bold text-triq-yellow">
          {role === 'drivers' ? 'Driver' : 'Passenger'} Leaderboard
        </h1>
      </div>

      {/* Period tabs */}
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => { setPeriod(p.key); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${period === p.key ? 'bg-triq-cyan/20 text-triq-cyan' : 'bg-triq-light/10 text-gray-400'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Metric tabs */}
      <div className="flex gap-2">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.key}
              onClick={() => { setMetric(m.key); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${metric === m.key ? 'bg-triq-yellow/20 text-triq-yellow' : 'bg-triq-light/10 text-gray-400'}`}
            >
              <Icon size={14} />
              {m.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-triq-cyan/30 border-t-triq-cyan rounded-full animate-spin" />
        </div>
      ) : !data || data.entries.length === 0 ? (
        <div className="card p-6 text-center">
          <Trophy size={32} className="text-gray-600 mx-auto mb-2" />
          <p className="text-white font-semibold">No entries yet</p>
          <p className="text-gray-400 text-sm mt-1">Complete rides to appear on the leaderboard</p>
        </div>
      ) : (
        <>
          {/* Top 3 podium */}
          {page === 1 && data.entries.length >= 3 && (
            <div className="grid grid-cols-3 gap-2">
              {[1, 0, 2].map((idx) => {
                const e = data.entries[idx];
                if (!e) return null;
                const podiumOrder = idx === 1 ? 0 : idx === 0 ? 1 : 2;
                return (
                  <div
                    key={e.id}
                    className={`card p-3 text-center ${rankBg(e.rank)}`}
                    style={{ order: podiumOrder }}
                  >
                    <div className={`text-2xl font-bold ${rankColors(e.rank)}`}>
                      {e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : '🥉'}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-triq-light/20 mx-auto my-1 flex items-center justify-center text-sm font-bold text-white">
                      {e.name.charAt(0)}
                    </div>
                    <p className="text-xs text-white font-semibold truncate">{e.name}</p>
                    <p className={`text-sm font-bold ${rankColors(e.rank)}`}>
                      {formatScore(e.score, metric)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full list */}
          <div className="space-y-2">
            {data.entries.map((e) => (
              <div key={e.id} className={`card p-3 flex items-center gap-3 ${rankBg(e.rank)}`}>
                <span className={`text-lg font-bold w-8 text-center ${rankColors(e.rank)}`}>
                  #{e.rank}
                </span>
                <div className="w-9 h-9 rounded-full bg-triq-light/20 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {e.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{e.name}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {e.plateNumber && <span>{e.plateNumber}</span>}
                    {e.rating !== undefined && (
                      <span className="flex items-center gap-0.5">
                        <Star size={10} className="text-triq-yellow" />
                        {e.rating.toFixed(1)}
                      </span>
                    )}
                    {e.subscriptionTier && e.subscriptionTier !== 'FREE' && (
                      <span className="text-triq-cyan font-medium">{e.subscriptionTier}</span>
                    )}
                    {e.tipCount !== undefined && <span>{e.tipCount} tips</span>}
                    {e.reviewCount !== undefined && <span>{e.reviewCount} reviews</span>}
                  </div>
                </div>
                <span className={`text-sm font-bold ${rankColors(e.rank)}`}>
                  {formatScore(e.score, metric)}
                </span>
              </div>
            ))}
          </div>

          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg bg-triq-light/10 text-gray-300 text-sm disabled:opacity-30"
              >
                Prev
              </button>
              <span className="text-sm text-gray-400">{page} / {data.pages}</span>
              <button
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page === data.pages}
                className="px-3 py-1.5 rounded-lg bg-triq-light/10 text-gray-300 text-sm disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
