import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

interface Report {
  id: string;
  reporterRole: string;
  reportedRole: string;
  category: string;
  severity: string;
  description: string | null;
  status: string;
  resolution: string | null;
  createdAt: string;
  ride: { id: string; pickupAddress: string; dropoffAddress: string };
}

export default function AdminReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolution, setResolution] = useState('');

  const fetchReports = () => {
    api.get('/admin/reports')
      .then((res) => setReports(res.data.reports))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const resolve = async (id: string) => {
    if (!resolution.trim()) return;
    try {
      await api.post(`/admin/reports/${id}/resolve`, { resolution });
      setResolving(null);
      setResolution('');
      fetchReports();
    } catch {}
  };

  const severityColors: Record<string, string> = {
    LOW: 'text-blue-400',
    MEDIUM: 'text-yellow-400',
    HIGH: 'text-orange-400',
    CRITICAL: 'text-red-400',
  };

  const statusColors: Record<string, string> = {
    PENDING: 'text-yellow-400',
    UNDER_REVIEW: 'text-blue-400',
    RESOLVED: 'text-green-400',
    DISMISSED: 'text-gray-400',
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
      <h1 className="text-2xl font-bold text-triq-yellow">Reports</h1>

      {reports.length === 0 ? (
        <div className="bg-triq-slate rounded-xl border border-triq-light/20 p-8 text-center">
          <p className="text-white font-semibold">No reports</p>
          <p className="text-gray-400 text-sm mt-1">All clear — no user reports to review</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className="bg-triq-slate rounded-xl border border-triq-light/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${severityColors[r.severity] || 'text-gray-400'}`}>
                    {r.severity}
                  </span>
                  <span className="text-xs text-gray-400">{r.category}</span>
                </div>
                <span className={`text-xs ${statusColors[r.status] || 'text-gray-400'}`}>{r.status}</span>
              </div>

              <p className="text-xs text-gray-400">
                {r.reporterRole} → {r.reportedRole}
              </p>

              {r.description && (
                <p className="text-sm text-white">{r.description}</p>
              )}

              <p className="text-xs text-gray-500">
                Ride: {r.ride.pickupAddress} → {r.ride.dropoffAddress}
              </p>

              <p className="text-xs text-gray-500">
                {new Date(r.createdAt).toLocaleString('en-PH')}
              </p>

              {r.status === 'RESOLVED' && r.resolution && (
                <div className="bg-green-500/10 rounded-lg px-2 py-1.5">
                  <p className="text-xs text-green-400">Resolved: {r.resolution}</p>
                </div>
              )}

              {r.status !== 'RESOLVED' && (
                resolving === r.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      placeholder="Resolution notes..."
                      className="w-full h-10 px-3 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => resolve(r.id)}
                        disabled={!resolution.trim()}
                        className="flex-1 h-10 rounded-lg bg-green-500 text-white font-bold text-sm disabled:opacity-40"
                      >
                        Confirm Resolve
                      </button>
                      <button
                        onClick={() => { setResolving(null); setResolution(''); }}
                        className="h-10 px-4 rounded-lg border border-triq-light/30 text-gray-400 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setResolving(r.id)}
                    className="w-full h-9 rounded-lg bg-green-500/20 text-green-400 text-sm font-medium border border-green-500/30"
                  >
                    Resolve
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
