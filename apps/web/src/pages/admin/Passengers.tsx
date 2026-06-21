import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Users, Search, Ban, CheckCircle } from 'lucide-react';

interface Passenger {
  id: string;
  name: string;
  kycStatus: string;
  trustScore: number;
  autoCancelledCount: number;
  userId: string;
  user: { phoneNumber: string; createdAt: string };
  _count: { rides: number; strikes: number };
}

interface PassengerData {
  passengers: Passenger[];
  total: number;
  page: number;
  pages: number;
}

export default function AdminPassengers() {
  const [data, setData] = useState<PassengerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/admin/passengers', { params: { page, search } })
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search]);

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

  const suspend = async (id: string) => {
    try {
      await api.patch(`/admin/passengers/${id}/suspend`);
      setData((prev) => prev ? {
        ...prev,
        passengers: prev.passengers.map((p) => p.id === id ? { ...p, trustScore: 0 } : p),
      } : null);
    } catch {}
  };

  const unsuspend = async (id: string) => {
    try {
      await api.patch(`/admin/passengers/${id}/unsuspend`);
      setData((prev) => prev ? {
        ...prev,
        passengers: prev.passengers.map((p) => p.id === id ? { ...p, trustScore: 100 } : p),
      } : null);
    } catch {}
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-triq-yellow">Passengers</h1>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name..."
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-triq-slate border border-triq-light/20 text-white text-sm"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-triq-cyan/30 border-t-triq-cyan rounded-full animate-spin" />
        </div>
      ) : !data || data.passengers.length === 0 ? (
        <div className="card p-6 text-center">
          <Users size={32} className="text-gray-600 mx-auto mb-2" />
          <p className="text-white font-semibold">No passengers found</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {data.passengers.map((p) => {
              const isSuspended = p.trustScore === 0;
              return (
                <div key={p.id} className="card p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.user.phoneNumber}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-bold ${isSuspended ? 'text-red-400' : p.trustScore < 50 ? 'text-orange-400' : 'text-green-400'}`}>
                        Trust: {p.trustScore}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>KYC: <span className={`font-medium ${p.kycStatus === 'VERIFIED' ? 'text-green-400' : p.kycStatus === 'REJECTED' ? 'text-red-400' : 'text-yellow-400'}`}>{p.kycStatus}</span></span>
                    <span>Rides: <span className="text-white font-bold">{p._count.rides}</span></span>
                    <span>Strikes: <span className={`font-bold ${p._count.strikes > 0 ? 'text-red-400' : 'text-gray-500'}`}>{p._count.strikes}</span></span>
                    <span>Auto-cancel: <span className="text-white">{p.autoCancelledCount}</span></span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-triq-light/10">
                    <span className="text-xs text-gray-500">Joined {formatDate(p.user.createdAt)}</span>
                    {isSuspended ? (
                      <button
                        onClick={() => unsuspend(p.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium"
                      >
                        <CheckCircle size={12} /> Reinstate
                      </button>
                    ) : (
                      <button
                        onClick={() => suspend(p.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium"
                      >
                        <Ban size={12} /> Suspend
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
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
