import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../lib/api';
import { Phone, Car, Star, Shield, Bike, MapPin, Crown, Award, Zap, X, Heart } from 'lucide-react';
import TipModal from '../../components/TipModal';

interface DriverData {
  id: string;
  name: string;
  plateNumber: string;
  tricycleModel: string | null;
  photoUrl: string | null;
  rating: number;
  reviewCount: number;
  totalRides: number;
  totalEarnings: number;
  isOnline: boolean;
  status: string;
  kycStatus: string;
  pickupRadius: number;
  subscriptionTier: string;
  subscriptionStatus: string;
}

interface KycData {
  kycStatus: string;
  kycRejectionReason: string | null;
  documents: { id: string; type: string; url: string; status: string }[];
}

interface BadgeData {
  badges: { id: string; awardedAt: string; badge: { code: string; name: string; description: string; iconUrl: string | null } }[];
  points: { id: string; points: number; reason: string; createdAt: string }[];
  totalPoints: number;
}

const DRIVER_DOC_TYPES = [
  { value: 'DRIVER_LICENSE', label: "Driver's License" },
  { value: 'FRANCHISE_PERMIT', label: 'Franchise Permit' },
  { value: 'OR_CR', label: 'OR / CR' },
  { value: 'GOVT_ID', label: 'Government ID' },
];

export default function DriverProfile() {
  const { user } = useAuthStore();
  const [driver, setDriver] = useState<DriverData | null>(null);
  const [kycData, setKycData] = useState<KycData | null>(null);
  const [badgeData, setBadgeData] = useState<BadgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [radius, setRadius] = useState(2.0);
  const [savingRadius, setSavingRadius] = useState(false);
  const [radiusSaved, setRadiusSaved] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);

  // KYC form state
  const [showKycForm, setShowKycForm] = useState(false);
  const [kycDocs, setKycDocs] = useState<{ type: string; url: string }[]>([{ type: '', url: '' }]);
  const [submittingKyc, setSubmittingKyc] = useState(false);

  // Subscription state
  const [subscribing, setSubscribing] = useState(false);
  const [proPrice, setProPrice] = useState<number>(50); // PHP, fetched from server
  const [elitePrice, setElitePrice] = useState<number>(99); // PHP, fetched from server

  useEffect(() => {
    api.get('/subscriptions/price')
      .then((res) => {
        setProPrice(res.data.pro.php);
        setElitePrice(res.data.elite.php);
      })
      .catch(() => {});
  }, []);

  const fetchAll = () => {
    if (!user) return;
    api.get('/drivers', { params: { userId: user.id } })
      .then((res) => {
        setDriver(res.data);
        setRadius(res.data.pickupRadius || 2.0);
        return Promise.all([
          api.get(`/drivers/${res.data.id}/kyc`),
          api.get('/gamification/badges/me'),
        ]);
      })
      .then(([kycRes, badgeRes]) => {
        setKycData(kycRes.data);
        setBadgeData(badgeRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, [user]);

  const saveRadius = async () => {
    if (!driver) return;
    setSavingRadius(true);
    try {
      await api.patch(`/drivers/${driver.id}/radius`, { radius });
      setRadiusSaved(true);
      setTimeout(() => setRadiusSaved(false), 2000);
    } catch {} finally { setSavingRadius(false); }
  };

  const submitKyc = async () => {
    if (!driver) return;
    const valid = kycDocs.filter((d) => d.type && d.url);
    if (valid.length === 0) return;
    setSubmittingKyc(true);
    try {
      await api.post(`/drivers/${driver.id}/kyc`, { documents: valid });
      setShowKycForm(false);
      setKycDocs([{ type: '', url: '' }]);
      fetchAll();
    } catch {} finally { setSubmittingKyc(false); }
  };

  const upgradeToPro = async (tier: 'PRO' | 'ELITE' = 'PRO') => {
    if (!driver) return;
    setSubscribing(true);
    try {
      const res = await api.post('/subscriptions/checkout', { driverId: driver.id, tier });
      if (res.data.checkoutUrl) {
        window.location.href = res.data.checkoutUrl;
      } else {
        fetchAll();
      }
    } catch {} finally { setSubscribing(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-8 h-8 border-2 border-triq-cyan/30 border-t-triq-cyan rounded-full animate-spin" />
      </div>
    );
  }

  const kycColor = kycData?.kycStatus === 'VERIFIED' ? 'text-green-400' : kycData?.kycStatus === 'REJECTED' ? 'text-red-400' : 'text-yellow-400';
  const kycLabel = kycData?.kycStatus === 'VERIFIED' ? 'Verified' : kycData?.kycStatus === 'REJECTED' ? 'Rejected' : kycData?.kycStatus === 'PENDING_REVIEW' ? 'Pending Review' : 'Not Submitted';

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-triq-yellow">Driver Profile</h2>

      <div className="card p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-triq-yellow/20 flex items-center justify-center text-triq-yellow font-bold text-2xl">
          {driver?.name?.charAt(0) || user?.phoneNumber?.charAt(user.phoneNumber.length - 1) || '?'}
        </div>
        <div>
          <p className="text-white font-semibold text-lg">{driver?.name || user?.phoneNumber || 'Unknown'}</p>
          <p className="text-gray-400 text-sm">Driver · {driver?.subscriptionTier || 'FREE'}</p>
        </div>
      </div>

      {/* Subscription card */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Crown size={18} className="text-triq-yellow" />
          <h3 className="text-sm font-semibold text-white">Subscription</h3>
        </div>
        {driver?.subscriptionTier === 'ELITE' ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-triq-yellow font-bold text-sm">ELITE Active</p>
              <p className="text-xs text-gray-400">All Pro perks + guaranteed top-3 placement · ₱{elitePrice}/month</p>
            </div>
            <span className="px-2 py-1 rounded-lg bg-triq-yellow/20 text-triq-yellow text-xs font-bold">ELITE</span>
          </div>
        ) : driver?.subscriptionTier === 'PRO' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-triq-yellow font-bold text-sm">PRO Active</p>
                <p className="text-xs text-gray-400">Rebook perk enabled · ₱{proPrice}/month</p>
              </div>
              <span className="px-2 py-1 rounded-lg bg-triq-yellow/20 text-triq-yellow text-xs font-bold">PRO</span>
            </div>
            <button
              onClick={() => upgradeToPro('ELITE')}
              disabled={subscribing}
              className="w-full h-9 rounded-lg bg-triq-yellow/20 border border-triq-yellow/40 text-triq-yellow font-bold text-sm disabled:opacity-40"
            >
              {subscribing ? 'Processing...' : `Upgrade to ELITE — ₱${elitePrice}/month`}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-400">Upgrade your subscription to unlock more perks.</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => upgradeToPro('PRO')}
                disabled={subscribing}
                className="h-16 rounded-lg bg-triq-cyan/10 border border-triq-cyan/30 text-white font-bold text-sm disabled:opacity-40 flex flex-col items-center justify-center gap-0.5"
              >
                <span className="text-triq-cyan text-xs font-bold uppercase tracking-wide">PRO</span>
                <span className="text-white font-bold">₱{proPrice}<span className="text-xs font-normal text-gray-400">/mo</span></span>
                <span className="text-[10px] text-gray-400">Rebook perk</span>
              </button>
              <button
                onClick={() => upgradeToPro('ELITE')}
                disabled={subscribing}
                className="h-16 rounded-lg bg-triq-yellow/10 border border-triq-yellow/30 text-white font-bold text-sm disabled:opacity-40 flex flex-col items-center justify-center gap-0.5"
              >
                <span className="text-triq-yellow text-xs font-bold uppercase tracking-wide">ELITE</span>
                <span className="text-white font-bold">₱{elitePrice}<span className="text-xs font-normal text-gray-400">/mo</span></span>
                <span className="text-[10px] text-gray-400">Top-3 + all perks</span>
              </button>
            </div>
            {subscribing && <p className="text-xs text-center text-gray-400">Processing...</p>}
          </div>
        )}
      </div>

      {/* KYC card */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-triq-cyan" />
          <h3 className="text-sm font-semibold text-white">KYC Verification</h3>
        </div>
        <div className="flex items-center justify-between">
          <p className={`text-sm ${kycColor}`}>{kycLabel}</p>
          {kycData?.kycStatus !== 'VERIFIED' && !showKycForm && (
            <button
              onClick={() => setShowKycForm(true)}
              className="px-3 py-1.5 rounded-lg bg-triq-cyan/20 text-triq-cyan text-xs font-medium"
            >
              {kycData?.kycStatus === 'REJECTED' ? 'Re-submit' : 'Submit KYC'}
            </button>
          )}
        </div>
        {kycData?.kycRejectionReason && (
          <p className="text-xs text-red-400">Reason: {kycData.kycRejectionReason}</p>
        )}
        {kycData?.documents && kycData.documents.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Submitted Documents</p>
            {kycData.documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between text-xs">
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-triq-cyan hover:underline">
                  {doc.type.replace(/_/g, ' ')}
                </a>
                <span className={doc.status === 'APPROVED' ? 'text-green-400' : doc.status === 'REJECTED' ? 'text-red-400' : 'text-yellow-400'}>
                  {doc.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* KYC submission form */}
      {showKycForm && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Submit KYC Documents</h3>
            <button onClick={() => setShowKycForm(false)} className="text-gray-400 hover:text-white"><X size={16} /></button>
          </div>
          <p className="text-xs text-gray-400">Upload your documents to a hosting service (e.g. Imgur, Google Drive) and paste the direct links below.</p>
          {kycDocs.map((doc, idx) => (
            <div key={idx} className="space-y-2">
              <select
                value={doc.type}
                onChange={(e) => setKycDocs((prev) => prev.map((d, i) => i === idx ? { ...d, type: e.target.value } : d))}
                className="w-full h-10 px-3 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm"
              >
                <option value="">Select document type...</option>
                {DRIVER_DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input
                type="url"
                value={doc.url}
                onChange={(e) => setKycDocs((prev) => prev.map((d, i) => i === idx ? { ...d, url: e.target.value } : d))}
                placeholder="https://example.com/document.jpg"
                className="w-full h-10 px-3 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm"
              />
            </div>
          ))}
          <button
            onClick={() => setKycDocs((prev) => [...prev, { type: '', url: '' }])}
            className="text-xs text-triq-cyan font-medium"
          >
            + Add another document
          </button>
          <button
            onClick={submitKyc}
            disabled={submittingKyc || !kycDocs.some((d) => d.type && d.url)}
            className="w-full h-10 rounded-lg bg-green-500 text-white font-bold text-sm disabled:opacity-40"
          >
            {submittingKyc ? 'Submitting...' : 'Submit for Review'}
          </button>
        </div>
      )}

      {/* Basic info */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Phone size={18} className="text-triq-cyan" />
          <div>
            <p className="text-xs text-gray-400">Phone</p>
            <p className="text-white text-sm">{user?.phoneNumber || 'Not set'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Bike size={18} className="text-triq-cyan" />
          <div>
            <p className="text-xs text-gray-400">Vehicle</p>
            <p className="text-white text-sm">{driver?.tricycleModel || 'Tricycle'} · {driver?.plateNumber || 'No plate'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Star size={18} className="text-triq-cyan" />
          <div>
            <p className="text-xs text-gray-400">Rating</p>
            <p className="text-white text-sm">{driver && driver.rating > 0 ? `${driver.rating.toFixed(1)} (${driver.totalRides} rides)` : 'No ratings yet'}</p>
          </div>
        </div>
        {driver?.status && (
          <div className="flex items-center gap-3">
            <Car size={18} className="text-triq-cyan" />
            <div>
              <p className="text-xs text-gray-400">Driver Status</p>
              <p className="text-white text-sm">{driver.status}</p>
            </div>
          </div>
        )}
      </div>

      {/* Badges & Points */}
      {badgeData && (badgeData.badges.length > 0 || badgeData.totalPoints > 0) && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Award size={18} className="text-triq-yellow" />
            <h3 className="text-sm font-semibold text-white">Badges & Points</h3>
          </div>
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-triq-yellow" />
            <span className="text-2xl font-bold text-triq-yellow">{badgeData.totalPoints}</span>
            <span className="text-xs text-gray-400">total points</span>
          </div>
          {badgeData.badges.length > 0 && (
            <div className="space-y-1">
              {badgeData.badges.map((b) => (
                <div key={b.id} className="flex items-center gap-2 text-xs">
                  <span className="text-triq-yellow font-medium">{b.badge.name}</span>
                  <span className="text-gray-500">{b.badge.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pickup radius setting */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-triq-cyan" />
          <h3 className="text-sm font-semibold text-white">Pickup Radius</h3>
        </div>
        <p className="text-xs text-gray-400">Set how far you're willing to travel to pick up a passenger.</p>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0.5"
            max="20"
            step="0.5"
            value={radius}
            onChange={(e) => setRadius(parseFloat(e.target.value))}
            className="flex-1 accent-triq-cyan"
          />
          <span className="text-triq-yellow font-bold text-sm w-16 text-right">{radius.toFixed(1)} km</span>
        </div>
        <button
          onClick={saveRadius}
          disabled={savingRadius}
          className="w-full h-9 rounded-lg bg-triq-cyan text-triq-dark font-bold text-sm disabled:opacity-40"
        >
          {savingRadius ? 'Saving...' : radiusSaved ? 'Saved!' : 'Save Radius'}
        </button>
      </div>

      {/* Support TriQ */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Heart size={18} className="text-triq-cyan" />
          <h3 className="text-sm font-semibold text-white">Support TriQ</h3>
        </div>
        <p className="text-xs text-gray-400 mb-3">Enjoying TriQ? Show your support with a small tip to help keep the platform running.</p>
        <button
          onClick={() => setShowTipModal(true)}
          className="w-full h-10 rounded-lg bg-triq-cyan/10 text-triq-cyan border border-triq-cyan/30 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-triq-cyan/20 transition-colors"
        >
          <Heart size={15} />
          Tip Platform
        </button>
      </div>

      <TipModal open={showTipModal} onClose={() => setShowTipModal(false)} />
    </div>
  );
}
