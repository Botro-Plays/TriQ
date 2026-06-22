import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../lib/api';
import { AlertTriangle, X, Phone, MapPin, CheckCircle, XCircle, Bell } from 'lucide-react';

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

function playAlertSound() {
  try {
    const ctx = new AudioContext();
    const beep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.01);
    };
    beep(880, 0.0, 0.18);
    beep(880, 0.25, 0.18);
    beep(1100, 0.5, 0.35);
  } catch {
    // AudioContext blocked by browser policy — silently ignore
  }
}

async function showBrowserNotification(count: number) {
  if (Notification.permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification('🚨 TriQ Emergency Alert', {
        body: `${count} active emergency${count > 1 ? 'ies' : ''} require attention!`,
        icon: '/icons/icon-192x192.png',
        requireInteraction: true,
        tag: 'triq-emergency',
      });
    } catch {
      // Fallback to regular notification
      new Notification('🚨 TriQ Emergency Alert', {
        body: `${count} active emergency${count > 1 ? 'ies' : ''} require attention!`,
        icon: '/icons/icon-192x192.png',
        requireInteraction: true,
        tag: 'triq-emergency',
      });
    }
  }
}

export default function AdminEmergencies() {
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'RESOLVED' | 'FALSE_ALARM'>('ACTIVE');
  const [resolveModal, setResolveModal] = useState<Emergency | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const knownActiveIds = useRef<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchEmergencies = useCallback(async (silent = false) => {
    try {
      const res = await api.get('/admin/emergencies', { params: { page: 1 } });
      const events: Emergency[] = res.data.events || [];

      // Detect new ACTIVE emergencies since last fetch
      const activeNow = events.filter((e) => e.status === 'ACTIVE');
      const newOnes = activeNow.filter((e) => !knownActiveIds.current.has(e.id));

      if (newOnes.length > 0 && !silent) {
        if (soundEnabled) playAlertSound();
        showBrowserNotification(activeNow.length);
        // Also request permission if not yet granted
        if (Notification.permission === 'default') Notification.requestPermission();
      }

      // Update known IDs
      knownActiveIds.current = new Set(activeNow.map((e) => e.id));

      setEmergencies(events);
    } catch {
      // silent fail on poll
    } finally {
      setLoading(false);
    }
  }, [soundEnabled]);

  // Initial load + start polling every 15 seconds
  useEffect(() => {
    fetchEmergencies(true); // silent on first load

    pollRef.current = setInterval(() => fetchEmergencies(false), 15000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchEmergencies]);

  const resolveEmergency = async (status: 'RESOLVED' | 'FALSE_ALARM') => {
    if (!resolveModal) return;
    setActionLoading(resolveModal.id);
    try {
      await api.patch(`/admin/emergencies/${resolveModal.id}/resolve`, { notes: resolveNotes, status });
      setEmergencies((prev) =>
        prev.map((e) => e.id === resolveModal.id ? { ...e, status, notes: resolveNotes } : e)
      );
      knownActiveIds.current.delete(resolveModal.id);
      setResolveModal(null);
      setResolveNotes('');
      showToast('success', status === 'RESOLVED' ? 'Emergency resolved' : 'Marked as false alarm');
    } catch (err: any) {
      showToast('error', err?.response?.data?.error || 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const filtered = statusFilter === 'all' ? emergencies : emergencies.filter((e) => e.status === statusFilter);
  const activeCount = emergencies.filter((e) => e.status === 'ACTIVE').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-triq-yellow">Emergencies</h1>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold animate-pulse">
              {activeCount} ACTIVE
            </span>
          )}
        </div>
        <button
          onClick={() => setSoundEnabled((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
            soundEnabled ? 'bg-triq-cyan/10 text-triq-cyan border-triq-cyan/30' : 'bg-triq-light/10 text-gray-400 border-triq-light/20'
          }`}
          title="Toggle alert sound"
        >
          <Bell size={12} />
          {soundEnabled ? 'Sound ON' : 'Sound OFF'}
        </button>
      </div>

      {toast && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={14} /> : <XCircle size={14} />}
          {toast.msg}
        </div>
      )}

      <p className="text-xs text-gray-500">Auto-refreshes every 15 seconds · Plays alert sound on new emergencies</p>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'ACTIVE', 'RESOLVED', 'FALSE_ALARM'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
              statusFilter === s
                ? s === 'ACTIVE' ? 'bg-red-500/20 text-red-400' : 'bg-triq-cyan/20 text-triq-cyan'
                : 'bg-triq-light/10 text-gray-400'
            }`}
          >
            {s === 'all' ? 'All' : s.replace('_', ' ')}
            {s === 'ACTIVE' && activeCount > 0 && ` (${activeCount})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-triq-cyan/30 border-t-triq-cyan rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <AlertTriangle size={36} className="text-gray-600 mx-auto mb-3" />
          <p className="text-white font-semibold">No {statusFilter === 'all' ? '' : statusFilter.replace('_', ' ').toLowerCase() + ' '}emergencies</p>
          <p className="text-gray-500 text-sm mt-1">Page auto-refreshes every 15 seconds</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => (
            <div
              key={e.id}
              className={`card p-4 space-y-3 ${
                e.status === 'ACTIVE' ? 'border border-red-500/50 bg-red-500/5' : ''
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    e.status === 'ACTIVE' ? 'bg-red-500/20 text-red-400' :
                    e.status === 'RESOLVED' ? 'bg-green-500/20 text-green-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>{e.status.replace('_', ' ')}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-medium">
                    {e.alertType}
                  </span>
                </div>
                <span className="text-xs text-gray-500">{formatDate(e.createdAt)}</span>
              </div>

              {/* Contacts */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-200">🧍 {e.ride.passenger.name}</span>
                  {e.ride.passenger.user.phoneNumber && (
                    <a href={`tel:${e.ride.passenger.user.phoneNumber}`}
                      className="flex items-center gap-1 text-sm text-triq-cyan font-medium">
                      <Phone size={12} /> {e.ride.passenger.user.phoneNumber}
                    </a>
                  )}
                </div>
                {e.ride.driver && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-200">🛺 {e.ride.driver.name} · {e.ride.driver.plateNumber}</span>
                    {e.ride.driver.user.phoneNumber && (
                      <a href={`tel:${e.ride.driver.user.phoneNumber}`}
                        className="flex items-center gap-1 text-sm text-triq-cyan font-medium">
                        <Phone size={12} /> {e.ride.driver.user.phoneNumber}
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Location */}
              <div className="text-xs text-gray-500">📍 {e.ride.pickupAddress} → {e.ride.dropoffAddress}</div>
              {e.lat && e.lng && (
                <a href={`https://maps.google.com/?q=${e.lat},${e.lng}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-triq-yellow">
                  <MapPin size={11} /> Open in Google Maps ({e.lat.toFixed(5)}, {e.lng.toFixed(5)})
                </a>
              )}

              {e.notes && (
                <p className="text-xs text-gray-300 italic border-t border-triq-light/10 pt-2">"{e.notes}"</p>
              )}
              {e.resolvedBy && (
                <p className="text-xs text-gray-500">
                  {e.status === 'FALSE_ALARM' ? 'False alarm' : 'Resolved'} by {e.resolvedBy}
                  {e.resolvedAt ? ` · ${formatDate(e.resolvedAt)}` : ''}
                </p>
              )}

              {e.status === 'ACTIVE' && (
                <button
                  onClick={() => { setResolveModal(e); setResolveNotes(''); }}
                  className="w-full h-9 rounded-lg bg-green-500/10 text-green-400 border border-green-500/30 text-sm font-medium"
                >
                  Take Action / Mark Resolved
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Resolve Modal */}
      {resolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setResolveModal(null)}>
          <div className="bg-triq-slate rounded-xl border border-triq-light/30 p-5 max-w-sm w-full space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">🚨 Emergency Action</h3>
              <button onClick={() => setResolveModal(null)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <p className="text-gray-400 text-xs uppercase tracking-wider">Contacts</p>
              <div className="flex items-center justify-between">
                <span className="text-gray-200">🧍 {resolveModal.ride.passenger.name}</span>
                {resolveModal.ride.passenger.user.phoneNumber && (
                  <a href={`tel:${resolveModal.ride.passenger.user.phoneNumber}`} className="text-triq-cyan flex items-center gap-1">
                    <Phone size={11} /> {resolveModal.ride.passenger.user.phoneNumber}
                  </a>
                )}
              </div>
              {resolveModal.ride.driver && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-200">🛺 {resolveModal.ride.driver.name}</span>
                  {resolveModal.ride.driver.user.phoneNumber && (
                    <a href={`tel:${resolveModal.ride.driver.user.phoneNumber}`} className="text-triq-cyan flex items-center gap-1">
                      <Phone size={11} /> {resolveModal.ride.driver.user.phoneNumber}
                    </a>
                  )}
                </div>
              )}
              {resolveModal.lat && resolveModal.lng && (
                <a href={`https://maps.google.com/?q=${resolveModal.lat},${resolveModal.lng}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-triq-yellow text-xs">
                  <MapPin size={11} /> View location on Google Maps
                </a>
              )}
            </div>

            {/* Action checklist */}
            <div className="bg-triq-dark/60 rounded-lg p-3 space-y-1.5 border border-triq-light/10">
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Recommended Actions</p>
              {[
                'Call the passenger to verify the situation',
                'Call the driver to assess from their side',
                'Check the ride location on Google Maps',
                'Contact local authorities if safety is at risk',
                'Document outcome in the notes below',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-gray-300">
                  <span className="text-triq-cyan font-bold mt-0.5">{i + 1}.</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>

            <textarea
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              placeholder="Notes (e.g. 'Contacted police at 10:45pm', 'Passenger confirmed false alarm')"
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm resize-none"
            />

            <div className="flex gap-2">
              <button
                onClick={() => resolveEmergency('RESOLVED')}
                disabled={actionLoading === resolveModal.id}
                className="flex-1 h-10 rounded-lg bg-green-500 text-white font-bold text-sm disabled:opacity-40"
              >
                {actionLoading === resolveModal.id ? 'Saving…' : '✅ Resolved'}
              </button>
              <button
                onClick={() => resolveEmergency('FALSE_ALARM')}
                disabled={actionLoading === resolveModal.id}
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
