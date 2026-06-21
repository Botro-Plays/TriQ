import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { CreditCard, Crown } from 'lucide-react';

interface Sub {
  id: string;
  tier: string;
  status: string;
  amount: number;
  isTrial: boolean;
  startedAt: string;
  expiresAt: string;
  cancelledAt: string | null;
  driver: { id: string; name: string; plateNumber: string; subscriptionTier: string };
}

interface SubData {
  subscriptions: Sub[];
  total: number;
  page: number;
  pages: number;
  activeRevenue: number;
}

export default function AdminSubscriptions() {
  const [data, setData] = useState<SubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    setLoading(true);
    api.get('/admin/subscriptions', { params: { page, status: statusFilter } })
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, statusFilter]);

  const formatPeso = (c: number) => `₱${(c / 100).toFixed(0)}`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

  const tierColors: Record<string, string> = {
    FREE: 'text-gray-400',
    PRO: 'text-triq-cyan',
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-triq-yellow">Subscriptions</h1>

      {data && (
        <div className="bg-gradient-to-r from-triq-slate to-triq-dark rounded-xl border border-triq-cyan/20 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Active Subscription Revenue</p>
          <p className="text-2xl font-bold text-triq-cyan">{formatPeso(data.activeRevenue)}</p>
        </div>
      )}

      <div className="flex gap-2">
        {['all', 'ACTIVE', 'EXPIRED', 'CANCELLED'].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${statusFilter === s ? 'bg-triq-cyan/20 text-triq-cyan' : 'bg-triq-light/10 text-gray-400'}`}
          >
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-triq-cyan/30 border-t-triq-cyan rounded-full animate-spin" />
        </div>
      ) : !data || data.subscriptions.length === 0 ? (
        <div className="card p-6 text-center">
          <CreditCard size={32} className="text-gray-600 mx-auto mb-2" />
          <p className="text-white font-semibold">No subscriptions found</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {data.subscriptions.map((sub) => (
              <div key={sub.id} className="card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crown size={14} className={tierColors[sub.tier] || 'text-gray-400'} />
                    <span className={`text-sm font-bold ${tierColors[sub.tier] || 'text-gray-400'}`}>{sub.tier}</span>
                    {sub.isTrial && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">TRIAL</span>}
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    sub.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
                    sub.status === 'CANCELLED' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>{sub.status}</span>
                </div>
                <div className="text-xs text-gray-400">
                  {sub.driver.name} · {sub.driver.plateNumber}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">{formatDate(sub.startedAt)} → {formatDate(sub.expiresAt)}</span>
                  <span className="text-triq-yellow font-bold">{formatPeso(sub.amount)}</span>
                </div>
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
