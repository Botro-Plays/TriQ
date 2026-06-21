import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../lib/api';
import { History, MapPin, Navigation } from 'lucide-react';

interface RideHistoryItem {
  id: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  estimatedFare: number;
  finalFare: number | null;
  createdAt: string;
  completedAt: string | null;
  driver: { name: string; plateNumber: string } | null;
}

export default function PassengerHistory() {
  const { user } = useAuthStore();
  const [rides, setRides] = useState<RideHistoryItem[]>([]);
  const [, setPassengerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api.get('/passengers', { params: { userId: user.id } })
      .then((res) => {
        setPassengerId(res.data.id);
        return api.get(`/passengers/${res.data.id}/rides`);
      })
      .then((res) => setRides(res.data.rides))
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

  const formatPeso = (c: number) => `₱${(c / 100).toFixed(0)}`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-triq-yellow">Ride History</h2>

      {rides.length === 0 ? (
        <div className="card p-6 text-center">
          <History size={32} className="text-gray-600 mx-auto mb-2" />
          <p className="text-white font-semibold">No rides yet</p>
          <p className="text-gray-400 text-sm mt-1">Your completed rides will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rides.map((ride) => (
            <div key={ride.id} className="card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  ride.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' :
                  ride.status === 'CANCELLED' ? 'bg-red-500/20 text-red-400' :
                  'bg-triq-cyan/20 text-triq-cyan'
                }`}>
                  {ride.status}
                </span>
                <span className="text-xs text-gray-500">{formatDate(ride.createdAt)}</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-start gap-1.5">
                  <MapPin size={10} className="text-green-400 mt-0.5 shrink-0" />
                  <span className="text-gray-300 truncate">{ride.pickupAddress}</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <Navigation size={10} className="text-red-400 mt-0.5 shrink-0" />
                  <span className="text-gray-300 truncate">{ride.dropoffAddress}</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-triq-light/10">
                {ride.driver ? (
                  <span className="text-xs text-gray-400">{ride.driver.name} · {ride.driver.plateNumber}</span>
                ) : (
                  <span className="text-xs text-gray-500">No driver</span>
                )}
                <span className="text-triq-yellow font-bold text-sm">
                  {formatPeso(ride.finalFare || ride.estimatedFare)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
