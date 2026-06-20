import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

interface Driver {
  id: string;
  name: string;
  plateNumber: string;
  status: string;
  isOnline: boolean;
  rating: number;
  totalRides: number;
  kycStatus: string;
  subscriptionTier: string;
  createdAt: string;
}

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchDrivers = () => {
    api.get('/admin/drivers', { params: { status: filter } })
      .then((res) => setDrivers(res.data.drivers))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDrivers();
  }, [filter]);

  const suspend = async (id: string) => {
    try {
      await api.patch(`/admin/drivers/${id}/suspend`);
      fetchDrivers();
    } catch {}
  };

  const unsuspend = async (id: string) => {
    try {
      await api.patch(`/admin/drivers/${id}/unsuspend`);
      fetchDrivers();
    } catch {}
  };

  const statusColors: Record<string, string> = {
    VERIFIED: 'text-green-400',
    PENDING: 'text-yellow-400',
    SUSPENDED: 'text-red-400',
  };

  const kycColors: Record<string, string> = {
    VERIFIED: 'text-green-400',
    PENDING_REVIEW: 'text-yellow-400',
    REJECTED: 'text-red-400',
    UNVERIFIED: 'text-gray-400',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-8 h-8 border-2 border-triq-cyan/30 border-t-triq-cyan rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-triq-yellow">Drivers</h1>
        <select
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setLoading(true); }}
          className="h-9 px-3 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm"
        >
          <option value="all">All</option>
          <option value="VERIFIED">Verified</option>
          <option value="PENDING">Pending</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>

      {drivers.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No drivers found</p>
      ) : (
        <div className="space-y-2">
          {drivers.map((d) => (
            <div key={d.id} className="bg-triq-slate rounded-xl border border-triq-light/20 p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-triq-cyan/20 flex items-center justify-center text-triq-cyan font-bold">
                  {d.name.charAt(0)}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{d.name}</p>
                  <p className="text-gray-400 text-xs">
                    {d.plateNumber} · ⭐ {d.rating.toFixed(1)} · {d.totalRides} rides
                  </p>
                  <p className="text-xs">
                    <span className={statusColors[d.status] || 'text-gray-400'}>{d.status}</span>
                    {' · '}
                    <span className={kycColors[d.kycStatus] || 'text-gray-400'}>KYC: {d.kycStatus}</span>
                    {d.isOnline && ' · 🟢 Online'}
                  </p>
                </div>
              </div>
              <div>
                {d.status === 'SUSPENDED' ? (
                  <button
                    onClick={() => unsuspend(d.id)}
                    className="px-3 h-9 rounded-lg bg-green-500/20 text-green-400 text-sm font-medium border border-green-500/30"
                  >
                    Reinstate
                  </button>
                ) : (
                  <button
                    onClick={() => suspend(d.id)}
                    className="px-3 h-9 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium border border-red-500/30"
                  >
                    Suspend
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
