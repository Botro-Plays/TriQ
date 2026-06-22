import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

interface KycDocument {
  id: string;
  type: string;
  url: string;
  status: string;
  createdAt: string;
  driver?: { id: string; name: string; plateNumber: string };
  passenger?: { id: string; name: string };
}

export default function AdminKycQueue() {
  const [documents, setDocuments] = useState<KycDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchDocs = () => {
    api.get('/admin/kyc/pending')
      .then((res) => setDocuments(res.data.documents))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const approve = async (docId: string) => {
    try {
      await api.post(`/admin/kyc/${docId}/approve`, {});
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch {}
  };

  const reject = async (docId: string) => {
    if (!rejectReason.trim()) return;
    try {
      await api.post(`/admin/kyc/${docId}/reject`, { reason: rejectReason });
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setRejecting(null);
      setRejectReason('');
    } catch {}
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
      <h1 className="text-2xl font-bold text-triq-yellow">KYC Queue</h1>

      {documents.length === 0 ? (
        <div className="bg-triq-slate rounded-xl border border-triq-light/20 p-8 text-center">
          <p className="text-white font-semibold">No pending KYC documents</p>
          <p className="text-gray-400 text-sm mt-1">All documents have been reviewed</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div key={doc.id} className="bg-triq-slate rounded-xl border border-triq-light/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold text-sm">
                    {doc.driver ? doc.driver.name : doc.passenger?.name}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {doc.driver ? `Driver · ${doc.driver.plateNumber}` : 'Passenger'} · {doc.type.replace(/_/g, ' ')}
                  </p>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(doc.createdAt).toLocaleDateString('en-PH')}
                </span>
              </div>

              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full h-32 rounded-lg bg-triq-dark border border-triq-light/20 overflow-hidden hover:border-triq-cyan/50 transition-colors"
              >
                <img
                  src={doc.url}
                  alt={doc.type}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement!.innerHTML = '<span class="flex items-center justify-center h-full text-triq-cyan text-sm">View Document</span>';
                  }}
                />
              </a>

              {rejecting === doc.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Rejection reason..."
                    className="w-full h-10 px-3 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => reject(doc.id)}
                      disabled={!rejectReason.trim()}
                      className="flex-1 h-10 rounded-lg bg-red-500 text-white font-bold text-sm disabled:opacity-40"
                    >
                      Confirm Reject
                    </button>
                    <button
                      onClick={() => { setRejecting(null); setRejectReason(''); }}
                      className="h-10 px-4 rounded-lg border border-triq-light/30 text-gray-400 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => approve(doc.id)}
                    className="flex-1 h-10 rounded-lg bg-green-500 text-white font-bold text-sm active:scale-[0.97]"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setRejecting(doc.id)}
                    className="flex-1 h-10 rounded-lg border border-red-500/30 text-red-400 text-sm font-medium"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
