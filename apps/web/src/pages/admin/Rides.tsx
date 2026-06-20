import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

interface Ride {
  id: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  estimatedFare: number;
  finalFare: number | null;
  createdAt: string;
  completedAt: string | null;
  passenger: { name: string };
  driver?: { name: string; plateNumber: string };
}

export default function AdminRides() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchRides = () => {
    api.get('/admin/rides', { params: { status: filter } })
      .then((res) => setRides(res.data.rides))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRides();
  }, [filter]);

  const statusColors: Record<string, string> = {
    REQUESTED: 'text-yellow-400',
    ACCEPTED: 'text-blue-400',
    ARRIVING: 'text-cyan-400',
    IN_PROGRESS: 'text-orange-400',
    COMPLETED: 'text-green-400',
    CANCELLED: 'text-red-400',
    COUNTER_OFFERED: 'text-purple-400',
  };

  const formatPeso = (centavos: number) => `₱${(centavos / 100).toFixed(0)}`;

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
        <h1 className="text-2xl font-bold text-triq-yellow">Rides</h1>
        <select
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setLoading(true); }}
          className="h-9 px-3 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm"
        >
          <option value="all">All</option>
          <option value="REQUESTED">Requested</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {rides.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No rides found</p>
      ) : (
        <div className="space-y-2">
          {rides.map((r) => (
            <div key={r.id} className="bg-triq-slate rounded-xl border border-triq-light/20 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold ${statusColors[r.status] || 'text-gray-400'}`}>
                  {r.status.replace(/_/g, ' ')}
                </span>
                <span className="text-triq-yellow font-bold text-sm">
                  {formatPeso(r.finalFare || r.estimatedFare)}
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <p className="text-gray-400">From: <span className="text-white">{r.pickupAddress}</span></p>
                <p className="text-gray-400">To: <span className="text-white">{r.dropoffAddress}</span></p>
                <p className="text-gray-400">
                  Passenger: <span className="text-white">{r.passenger.name}</span>
                  {r.driver && <> · Driver: <span className="text-white">{r.driver.name}</span></>}
                </p>
                <p className="text-gray-500">
                  {new Date(r.createdAt).toLocaleString('en-PH')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
