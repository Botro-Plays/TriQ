import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { CreditCard, Crown, Gift, Search, CheckCircle, XCircle } from 'lucide-react';

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

interface DriverSuggestion {
  id: string;
  name: string;
  plateNumber: string;
  subscriptionTier: string;
}

const DURATION_PRESETS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '365 days', days: 365 },
];

function GrantVipSection({ onGranted }: { onGranted: () => void }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<DriverSuggestion[]>([]);
  const [selected, setSelected] = useState<DriverSuggestion | null>(null);
  const [tier, setTier] = useState<'PRO' | 'ELITE'>('PRO');
  const [days, setDays] = useState(30);
  const [customDays, setCustomDays] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const searchDrivers = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/admin/drivers', { params: { search: q, limit: 6 } });
        setSuggestions(res.data.drivers || []);
        setShowSuggestions(true);
      } catch { setSuggestions([]); }
    }, 300);
  };

  const handleGrant = async () => {
    if (!selected) { showToast('error', 'Select a driver first'); return; }
    const finalDays = customDays ? parseInt(customDays) : days;
    if (!finalDays || finalDays < 1) { showToast('error', 'Invalid duration'); return; }
    setLoading(true);
    try {
      const res = await api.post('/admin/grant-vip', { driverId: selected.id, tier, days: finalDays, reason });
      const d = res.data.driver;
      showToast('success', `✅ ${tier} granted to ${d.name} for ${finalDays} days`);
      setSelected(null); setQuery(''); setReason(''); setCustomDays('');
      onGranted();
    } catch (err: any) {
      showToast('error', err?.response?.data?.error || 'Failed to grant VIP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-4 space-y-3 border border-triq-yellow/20">
      <div className="flex items-center gap-2">
        <Gift size={16} className="text-triq-yellow" />
        <h2 className="text-sm font-bold text-triq-yellow">Grant Free VIP</h2>
      </div>

      {toast && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
          toast.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={12} /> : <XCircle size={12} />}
          {toast.msg}
        </div>
      )}

      {/* Driver search */}
      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-triq-dark border border-triq-light/30">
          <Search size={13} className="text-gray-400 shrink-0" />
          <input
            value={selected ? `${selected.name} (${selected.plateNumber})` : query}
            onChange={(e) => {
              setSelected(null);
              setQuery(e.target.value);
              searchDrivers(e.target.value);
            }}
            onFocus={() => { if (suggestions.length) setShowSuggestions(true); }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Search driver by name or plate…"
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-gray-500"
          />
          {selected && (
            <button onClick={() => { setSelected(null); setQuery(''); setSuggestions([]); }}
              className="text-gray-400 hover:text-white">
              <XCircle size={13} />
            </button>
          )}
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-triq-slate border border-triq-light/30 rounded-lg shadow-xl overflow-hidden">
            {suggestions.map((d) => (
              <button
                key={d.id}
                onMouseDown={() => { setSelected(d); setQuery(''); setShowSuggestions(false); }}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-triq-light/10 text-left"
              >
                <span className="text-sm text-white">{d.name}</span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400">{d.plateNumber}</span>
                  <span className={`font-bold ${d.subscriptionTier === 'ELITE' ? 'text-triq-yellow' : d.subscriptionTier === 'PRO' ? 'text-triq-cyan' : 'text-gray-500'}`}>
                    {d.subscriptionTier}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tier selector */}
      <div className="flex gap-2">
        {(['PRO', 'ELITE'] as const).map((t) => (
          <button key={t} onClick={() => setTier(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${
              tier === t
                ? t === 'ELITE' ? 'bg-triq-yellow/20 text-triq-yellow border-triq-yellow/40' : 'bg-triq-cyan/20 text-triq-cyan border-triq-cyan/40'
                : 'bg-triq-light/10 text-gray-400 border-triq-light/20'
            }`}>
            <Crown size={12} className="inline mr-1" />{t}
          </button>
        ))}
      </div>

      {/* Duration presets */}
      <div>
        <p className="text-xs text-gray-400 mb-1.5">Duration</p>
        <div className="flex gap-2 flex-wrap">
          {DURATION_PRESETS.map((p) => (
            <button key={p.days} onClick={() => { setDays(p.days); setCustomDays(''); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${days === p.days && !customDays ? 'bg-triq-cyan/20 text-triq-cyan' : 'bg-triq-light/10 text-gray-400'}`}>
              {p.label}
            </button>
          ))}
          <input
            type="number"
            min={1}
            max={365}
            value={customDays}
            onChange={(e) => setCustomDays(e.target.value)}
            placeholder="Custom days"
            className="w-24 px-2 py-1.5 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-xs"
          />
        </div>
      </div>

      {/* Reason */}
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional, e.g. 'Referral bonus', 'Contest winner')"
        className="w-full px-3 py-2 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm"
      />

      <button
        onClick={handleGrant}
        disabled={!selected || loading}
        className="w-full h-10 rounded-lg bg-triq-yellow text-triq-dark font-bold text-sm disabled:opacity-40"
      >
        {loading ? 'Granting…' : `Grant ${tier} for ${customDays || days} day${(customDays ? parseInt(customDays) : days) !== 1 ? 's' : ''}`}
      </button>
    </div>
  );
}

export default function AdminSubscriptions() {
  const [data, setData] = useState<SubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    api.get('/admin/subscriptions', { params: { page, status: statusFilter } })
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, statusFilter, refreshKey]);

  const formatPeso = (c: number) => `₱${(c / 100).toFixed(0)}`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

  const tierColors: Record<string, string> = {
    FREE: 'text-gray-400',
    PRO: 'text-triq-cyan',
    ELITE: 'text-triq-yellow',
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-triq-yellow">Subscriptions</h1>

      <GrantVipSection onGranted={() => setRefreshKey((k) => k + 1)} />

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
