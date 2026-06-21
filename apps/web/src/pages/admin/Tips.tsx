import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Heart } from 'lucide-react';

interface Tip {
  id: string;
  amount: number;
  status: string;
  paymongoId: string | null;
  createdAt: string;
  paidAt: string | null;
  passenger: { id: string; name: string };
  ride: { id: string; driver: { name: string; plateNumber: string } | null } | null;
}

interface TipData {
  tips: Tip[];
  total: number;
  page: number;
  pages: number;
  totalPaid: number;
}

export default function AdminTips() {
  const [data, setData] = useState<TipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    setLoading(true);
    api.get('/admin/tips', { params: { page, status: statusFilter } })
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, statusFilter]);

  const formatPeso = (c: number) => `₱${(c / 100).toFixed(0)}`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-triq-yellow">Platform Tips</h1>

      {data && (
        <div className="bg-gradient-to-r from-triq-slate to-triq-dark rounded-xl border border-triq-cyan/20 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Total Paid Tips</p>
          <p className="text-2xl font-bold text-triq-cyan">{formatPeso(data.totalPaid)}</p>
        </div>
      )}

      <div className="flex gap-2">
        {['all', 'PAID', 'PENDING', 'FAILED'].map((s) => (
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
      ) : !data || data.tips.length === 0 ? (
        <div className="card p-6 text-center">
          <Heart size={32} className="text-gray-600 mx-auto mb-2" />
          <p className="text-white font-semibold">No tips found</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {data.tips.map((tip) => (
              <div key={tip.id} className="card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white">{tip.passenger.name}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    tip.status === 'PAID' ? 'bg-green-500/20 text-green-400' :
                    tip.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>{tip.status}</span>
                </div>
                {tip.ride?.driver && (
                  <div className="text-xs text-gray-400">
                    → {tip.ride.driver.name} · {tip.ride.driver.plateNumber}
                  </div>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">{formatDate(tip.createdAt)}</span>
                  <span className="text-triq-cyan font-bold">{formatPeso(tip.amount)}</span>
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
