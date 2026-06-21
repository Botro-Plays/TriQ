import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { ShieldAlert, AlertTriangle, Settings, X, ThumbsUp, ThumbsDown, MessageSquare, CheckCircle, XCircle, Phone, MapPin } from 'lucide-react';

type Tab = 'strikes' | 'emergencies' | 'config' | 'thumbs' | 'feedback';

interface Strike {
  id: string;
  reason: string;
  issuedBy: string;
  createdAt: string;
  expiresAt: string | null;
  passenger: { name: string };
  ride: { id: string; pickupAddress: string };
}

interface Emergency {
  id: string;
  alertType: string;
  status: string;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  ride: {
    id: string;
    pickupAddress: string;
    dropoffAddress: string;
    passenger: { name: string; user: { phoneNumber: string | null } };
    driver: { name: string; plateNumber: string; user: { phoneNumber: string | null } } | null;
  };
}

interface Config {
  id: string;
  key: string;
  value: string;
  masked: boolean;
  description: string | null;
  updatedAt: string;
}

interface ThumbsAnalytics {
  driverThumbs: { up: number; down: number };
  passengerThumbs: { up: number; down: number };
  topDrivers: { id: string; name: string; plateNumber: string; totalThumbs: number }[];
  topPassengers: { id: string; name: string; totalFeedback: number }[];
}

interface PassengerFeedback {
  id: string;
  thumbsUp: boolean;
  comment: string | null;
  createdAt: string;
  from: { name: string; plateNumber: string };
  to: { name: string };
  ride: { id: string; pickupAddress: string; dropoffAddress: string };
}

interface FeedbackData {
  feedback: PassengerFeedback[];
  total: number;
  page: number;
  pages: number;
}

export default function AdminMore() {
  const [tab, setTab] = useState<Tab>('strikes');
  const [strikes, setStrikes] = useState<Strike[]>([]);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [configs, setConfigs] = useState<Config[]>([]);
  const [thumbsData, setThumbsData] = useState<ThumbsAnalytics | null>(null);
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null);
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [feedbackFilter, setFeedbackFilter] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [resolveModal, setResolveModal] = useState<Emergency | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    setLoading(true);
    if (tab === 'strikes') {
      api.get('/admin/strikes')
        .then((res) => setStrikes(res.data.strikes))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else if (tab === 'emergencies') {
      api.get('/admin/emergencies')
        .then((res) => setEmergencies(res.data.events))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else if (tab === 'thumbs') {
      api.get('/admin/thumbs-analytics')
        .then((res) => setThumbsData(res.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else if (tab === 'feedback') {
      api.get('/admin/passenger-feedback', { params: { page: feedbackPage, thumbsUp: feedbackFilter } })
        .then((res) => setFeedbackData(res.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      api.get('/admin/config')
        .then((res) => setConfigs(res.data.configs))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [tab, feedbackPage, feedbackFilter]);

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

  const revokeStrike = async (id: string) => {
    setActionLoading(id);
    try {
      await api.patch(`/admin/strikes/${id}/revoke`);
      setStrikes((prev) => prev.filter((s) => s.id !== id));
      showToast('success', 'Strike revoked');
    } catch (err: any) {
      showToast('error', err?.response?.data?.error || 'Failed to revoke strike');
    } finally {
      setActionLoading(null);
    }
  };

  const resolveEmergency = async () => {
    if (!resolveModal) return;
    setActionLoading(resolveModal.id);
    try {
      await api.patch(`/admin/emergencies/${resolveModal.id}/resolve`, { notes: resolveNotes });
      setEmergencies((prev) => prev.map((e) => e.id === resolveModal.id ? { ...e, status: 'RESOLVED', notes: resolveNotes } : e));
      setResolveModal(null);
      setResolveNotes('');
      showToast('success', 'Emergency marked as resolved');
    } catch (err: any) {
      showToast('error', err?.response?.data?.error || 'Failed to resolve emergency');
    } finally {
      setActionLoading(null);
    }
  };

  const updateConfig = async (key: string, value: string) => {
    try {
      await api.patch(`/admin/config/${key}`, { value });
      // Re-fetch configs so masked values are refreshed from server
      const res = await api.get('/admin/config');
      setConfigs(res.data.configs);
      showToast('success', `${key} updated`);
    } catch (err: any) {
      showToast('error', err?.response?.data?.error || 'Failed to update config');
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-triq-yellow">Safety & Config</h1>

      {toast && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={14} /> : <XCircle size={14} />}
          {toast.msg}
        </div>
      )}

      <div className="flex gap-2">
        {[
          { key: 'strikes' as Tab, label: 'Strikes', icon: ShieldAlert },
          { key: 'emergencies' as Tab, label: 'Emergencies', icon: AlertTriangle },
          { key: 'thumbs' as Tab, label: 'Thumbs', icon: ThumbsUp },
          { key: 'feedback' as Tab, label: 'Feedback', icon: MessageSquare },
          { key: 'config' as Tab, label: 'Config', icon: Settings },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${tab === t.key ? 'bg-triq-cyan/20 text-triq-cyan' : 'bg-triq-light/10 text-gray-400'}`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-triq-cyan/30 border-t-triq-cyan rounded-full animate-spin" />
        </div>
      ) : tab === 'strikes' ? (
        strikes.length === 0 ? (
          <div className="card p-6 text-center">
            <ShieldAlert size={32} className="text-gray-600 mx-auto mb-2" />
            <p className="text-white font-semibold">No active strikes</p>
          </div>
        ) : (
          <div className="space-y-2">
            {strikes.map((s) => (
              <div key={s.id} className="card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-red-400">{s.reason}</span>
                  <span className="text-xs text-gray-500">{formatDate(s.createdAt)}</span>
                </div>
                <div className="text-xs text-gray-400">
                  {s.passenger.name} · {s.ride.pickupAddress}
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-triq-light/10">
                  <span className="text-xs text-gray-500">Issued by: {s.issuedBy}</span>
                  <button
                    onClick={() => revokeStrike(s.id)}
                    disabled={actionLoading === s.id}
                    className="px-2 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium disabled:opacity-40"
                  >
                    {actionLoading === s.id ? 'Revoking…' : 'Revoke'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === 'emergencies' ? (
        emergencies.length === 0 ? (
          <div className="card p-6 text-center">
            <AlertTriangle size={32} className="text-gray-600 mx-auto mb-2" />
            <p className="text-white font-semibold">No emergency events</p>
          </div>
        ) : (
          <div className="space-y-2">
            {emergencies.map((e) => (
              <div key={e.id} className={`card p-3 space-y-2 ${e.status === 'ACTIVE' ? 'border border-red-500/40' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      e.status === 'ACTIVE' ? 'bg-red-500/20 text-red-400' :
                      e.status === 'RESOLVED' ? 'bg-green-500/20 text-green-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>{e.status}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-medium">{e.alertType}</span>
                  </div>
                  <span className="text-xs text-gray-500">{formatDate(e.createdAt)}</span>
                </div>

                {/* Contact info */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300">🧍 {e.ride.passenger.name}</span>
                    {e.ride.passenger.user.phoneNumber && (
                      <a href={`tel:${e.ride.passenger.user.phoneNumber}`}
                        className="flex items-center gap-1 text-xs text-triq-cyan">
                        <Phone size={11} /> {e.ride.passenger.user.phoneNumber}
                      </a>
                    )}
                  </div>
                  {e.ride.driver && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-300">🛺 {e.ride.driver.name} ({e.ride.driver.plateNumber})</span>
                      {e.ride.driver.user.phoneNumber && (
                        <a href={`tel:${e.ride.driver.user.phoneNumber}`}
                          className="flex items-center gap-1 text-xs text-triq-cyan">
                          <Phone size={11} /> {e.ride.driver.user.phoneNumber}
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-xs text-gray-500 truncate">
                  📍 {e.ride.pickupAddress} → {e.ride.dropoffAddress}
                </div>

                {/* Map link if coordinates known */}
                {e.lat && e.lng && (
                  <a
                    href={`https://maps.google.com/?q=${e.lat},${e.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-triq-yellow"
                  >
                    <MapPin size={11} /> View on Google Maps ({e.lat.toFixed(5)}, {e.lng.toFixed(5)})
                  </a>
                )}

                {e.notes && <p className="text-xs text-gray-300 italic border-t border-triq-light/10 pt-1">"{e.notes}"</p>}
                {e.resolvedBy && (
                  <p className="text-xs text-gray-500">Resolved by {e.resolvedBy} · {e.resolvedAt ? formatDate(e.resolvedAt) : ''}</p>
                )}

                {e.status === 'ACTIVE' && (
                  <button
                    onClick={() => { setResolveModal(e); setResolveNotes(''); }}
                    className="w-full h-8 rounded-lg bg-green-500/10 text-green-400 border border-green-500/30 text-xs font-medium"
                  >
                    Take Action / Mark Resolved
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      ) : tab === 'thumbs' ? (
        !thumbsData ? (
          <div className="card p-6 text-center">
            <ThumbsUp size={32} className="text-gray-600 mx-auto mb-2" />
            <p className="text-white font-semibold">No data available</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-3">
                <p className="text-xs text-gray-400 mb-2">Driver Thumbs (Passenger → Driver)</p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <ThumbsUp size={14} className="text-green-400" />
                    <span className="text-green-400 font-bold text-sm">{thumbsData.driverThumbs.up}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ThumbsDown size={14} className="text-red-400" />
                    <span className="text-red-400 font-bold text-sm">{thumbsData.driverThumbs.down}</span>
                  </div>
                </div>
              </div>
              <div className="card p-3">
                <p className="text-xs text-gray-400 mb-2">Passenger Thumbs (Driver → Passenger)</p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <ThumbsUp size={14} className="text-green-400" />
                    <span className="text-green-400 font-bold text-sm">{thumbsData.passengerThumbs.up}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ThumbsDown size={14} className="text-red-400" />
                    <span className="text-red-400 font-bold text-sm">{thumbsData.passengerThumbs.down}</span>
                  </div>
                </div>
              </div>
            </div>
            {thumbsData.topDrivers.length > 0 && (
              <div className="card p-3 space-y-2">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Top Drivers by Thumbs</p>
                {thumbsData.topDrivers.map((d, i) => (
                  <div key={d.id} className="flex items-center justify-between text-xs">
                    <span className="text-white">{i + 1}. {d.name} ({d.plateNumber})</span>
                    <span className="text-triq-yellow font-bold">{d.totalThumbs}</span>
                  </div>
                ))}
              </div>
            )}
            {thumbsData.topPassengers.length > 0 && (
              <div className="card p-3 space-y-2">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Top Passengers by Feedback</p>
                {thumbsData.topPassengers.map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span className="text-white">{i + 1}. {p.name}</span>
                    <span className="text-triq-yellow font-bold">{p.totalFeedback}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      ) : tab === 'feedback' ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => { setFeedbackFilter(undefined); setFeedbackPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${!feedbackFilter ? 'bg-triq-cyan/20 text-triq-cyan' : 'bg-triq-light/10 text-gray-400'}`}
            >
              All
            </button>
            <button
              onClick={() => { setFeedbackFilter('true'); setFeedbackPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${feedbackFilter === 'true' ? 'bg-green-500/20 text-green-400' : 'bg-triq-light/10 text-gray-400'}`}
            >
              Thumbs Up
            </button>
            <button
              onClick={() => { setFeedbackFilter('false'); setFeedbackPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${feedbackFilter === 'false' ? 'bg-red-500/20 text-red-400' : 'bg-triq-light/10 text-gray-400'}`}
            >
              Thumbs Down
            </button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-2 border-triq-cyan/30 border-t-triq-cyan rounded-full animate-spin" />
            </div>
          ) : !feedbackData || feedbackData.feedback.length === 0 ? (
            <div className="card p-6 text-center">
              <MessageSquare size={32} className="text-gray-600 mx-auto mb-2" />
              <p className="text-white font-semibold">No feedback found</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {feedbackData.feedback.map((fb) => (
                  <div key={fb.id} className="card p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {fb.thumbsUp
                          ? <ThumbsUp size={12} className="text-green-400" />
                          : <ThumbsDown size={12} className="text-red-400" />}
                        <span className="text-xs text-gray-400">
                          {fb.from.name} ({fb.from.plateNumber}) → {fb.to.name}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">{formatDate(fb.createdAt)}</span>
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {fb.ride.pickupAddress} → {fb.ride.dropoffAddress}
                    </div>
                    {fb.comment && (
                      <p className="text-xs text-gray-300 italic pt-1 border-t border-triq-light/10">"{fb.comment}"</p>
                    )}
                  </div>
                ))}
              </div>
              {feedbackData.pages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => setFeedbackPage((p) => Math.max(1, p - 1))}
                    disabled={feedbackPage === 1}
                    className="px-3 py-1.5 rounded-lg bg-triq-light/10 text-gray-300 text-sm disabled:opacity-30"
                  >
                    Prev
                  </button>
                  <span className="text-sm text-gray-400">{feedbackPage} / {feedbackData.pages}</span>
                  <button
                    onClick={() => setFeedbackPage((p) => Math.min(feedbackData.pages, p + 1))}
                    disabled={feedbackPage === feedbackData.pages}
                    className="px-3 py-1.5 rounded-lg bg-triq-light/10 text-gray-300 text-sm disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {configs.length === 0 ? (
            <div className="card p-6 text-center">
              <Settings size={32} className="text-gray-600 mx-auto mb-2" />
              <p className="text-white font-semibold">No config entries</p>
              <p className="text-gray-400 text-sm mt-1">System config keys will appear here once set</p>
            </div>
          ) : (
            configs.map((c) => <ConfigRow key={c.id} config={c} onSave={updateConfig} formatDate={formatDate} />)
          )}
        </div>
      )}

      {/* Resolve emergency modal */}
      {resolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setResolveModal(null)}>
          <div className="bg-triq-slate rounded-xl border border-triq-light/30 p-5 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Resolve Emergency</h3>
              <button onClick={() => setResolveModal(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-gray-300">🧍 {resolveModal.ride.passenger.name}
                {resolveModal.ride.passenger.user.phoneNumber && (
                  <a href={`tel:${resolveModal.ride.passenger.user.phoneNumber}`} className="ml-2 text-triq-cyan">
                    <Phone size={12} className="inline" /> {resolveModal.ride.passenger.user.phoneNumber}
                  </a>
                )}
              </p>
              {resolveModal.ride.driver && (
                <p className="text-gray-300">🛺 {resolveModal.ride.driver.name} ({resolveModal.ride.driver.plateNumber})
                  {resolveModal.ride.driver.user.phoneNumber && (
                    <a href={`tel:${resolveModal.ride.driver.user.phoneNumber}`} className="ml-2 text-triq-cyan">
                      <Phone size={12} className="inline" /> {resolveModal.ride.driver.user.phoneNumber}
                    </a>
                  )}
                </p>
              )}
              {resolveModal.lat && resolveModal.lng && (
                <a
                  href={`https://maps.google.com/?q=${resolveModal.lat},${resolveModal.lng}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-triq-yellow text-xs"
                >
                  <MapPin size={11} /> View location on Google Maps
                </a>
              )}
            </div>
            <textarea
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              placeholder="Resolution notes (e.g. 'Contacted police', 'False alarm confirmed by passenger')"
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={resolveEmergency}
                disabled={actionLoading === resolveModal?.id}
                className="flex-1 h-10 rounded-lg bg-green-500 text-white font-bold text-sm disabled:opacity-40"
              >
                {actionLoading === resolveModal?.id ? 'Saving…' : '✅ Mark Resolved'}
              </button>
              <button
                onClick={async () => {
                  if (!resolveModal) return;
                  setActionLoading(resolveModal.id);
                  try {
                    await api.patch(`/admin/emergencies/${resolveModal.id}/resolve`, { notes: resolveNotes, status: 'FALSE_ALARM' });
                    setEmergencies((prev) => prev.map((e) => e.id === resolveModal.id ? { ...e, status: 'FALSE_ALARM', notes: resolveNotes } : e));
                    setResolveModal(null); setResolveNotes('');
                    showToast('success', 'Marked as false alarm');
                  } catch (err: any) {
                    showToast('error', err?.response?.data?.error || 'Failed');
                  } finally { setActionLoading(null); }
                }}
                disabled={actionLoading === resolveModal?.id}
                className="flex-1 h-10 rounded-lg bg-gray-500/20 text-gray-300 border border-gray-500/30 font-bold text-sm disabled:opacity-40"
              >
                🚫 False Alarm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfigRow({ config, onSave, formatDate }: { config: Config; onSave: (key: string, value: string) => void; formatDate: (d: string) => string }) {
  const [value, setValue] = useState('');
  const [editing, setEditing] = useState(false);

  const startEdit = () => {
    // For masked fields, clear the input so admin must re-enter the full value
    setValue(config.masked ? '' : config.value);
    setEditing(true);
  };

  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-triq-cyan">{config.key}</span>
          {config.masked && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/20">sensitive</span>
          )}
        </div>
        <span className="text-xs text-gray-500">Updated {formatDate(config.updatedAt)}</span>
      </div>
      {config.description && <p className="text-xs text-gray-400">{config.description}</p>}
      {editing ? (
        <div className="flex gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={config.masked ? 'Enter new value…' : undefined}
            className="flex-1 px-2 py-1 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm"
            type={config.masked ? 'password' : 'text'}
            autoComplete="off"
          />
          <button
            onClick={() => { if (value.trim()) onSave(config.key, value); setEditing(false); }}
            className="px-3 py-1 rounded-lg bg-green-500/20 text-green-400 text-xs font-medium"
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-2 py-1 rounded-lg bg-triq-light/10 text-gray-400 text-xs font-medium"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-sm font-mono text-white">{config.value}</span>
          <button
            onClick={startEdit}
            className="px-2 py-1 rounded-lg bg-triq-light/10 text-gray-300 text-xs font-medium"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
