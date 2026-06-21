import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../lib/api';
import { Phone, Shield, Award, Zap, X, MapPin, Heart } from 'lucide-react';
import TipModal from '../../components/TipModal';

interface PassengerData {
  id: string;
  name: string;
  photoUrl: string | null;
  kycStatus: string;
  trustScore: number;
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

interface SavedPlace {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
}

const PASSENGER_DOC_TYPES = [
  { value: 'GOVT_ID', label: 'Government ID (UMID, Passport, Voter\'s ID, Postal ID, etc.)' },
  { value: 'DRIVER_LICENSE', label: "Driver's License" },
];

export default function PassengerProfile() {
  const { user } = useAuthStore();
  const [passenger, setPassenger] = useState<PassengerData | null>(null);
  const [kycData, setKycData] = useState<KycData | null>(null);
  const [badgeData, setBadgeData] = useState<BadgeData | null>(null);
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);

  // KYC form state
  const [showKycForm, setShowKycForm] = useState(false);
  const [docType, setDocType] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [showTipModal, setShowTipModal] = useState(false);
  const [selfieUrl, setSelfieUrl] = useState('');
  const [submittingKyc, setSubmittingKyc] = useState(false);

  const fetchAll = () => {
    if (!user) return;
    api.get('/passengers', { params: { userId: user.id } })
      .then((res) => {
        setPassenger(res.data);
        return Promise.all([
          api.get(`/passengers/${res.data.id}/kyc`),
          api.get('/gamification/badges/me'),
          api.get(`/passengers/${res.data.id}/places`),
        ]);
      })
      .then(([kycRes, badgeRes, placesRes]) => {
        setKycData(kycRes.data);
        setBadgeData(badgeRes.data);
        setPlaces(placesRes.data.places);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, [user]);

  const submitKyc = async () => {
    if (!passenger || !docType || !docUrl) return;
    setSubmittingKyc(true);
    try {
      await api.post(`/passengers/${passenger.id}/kyc`, {
        documentType: docType,
        documentUrl: docUrl,
        selfieUrl: selfieUrl || undefined,
      });
      setShowKycForm(false);
      setDocType('');
      setDocUrl('');
      setSelfieUrl('');
      fetchAll();
    } catch {} finally { setSubmittingKyc(false); }
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
      <h2 className="text-2xl font-bold text-triq-yellow">Profile</h2>

      <div className="card p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-triq-cyan/20 flex items-center justify-center text-triq-cyan font-bold text-2xl">
          {passenger?.name?.charAt(0) || user?.phoneNumber?.charAt(user.phoneNumber.length - 1) || '?'}
        </div>
        <div>
          <p className="text-white font-semibold text-lg">{passenger?.name || user?.phoneNumber || 'Unknown'}</p>
          <p className="text-gray-400 text-sm">Passenger · Trust Score: {passenger?.trustScore?.toFixed(1) || '—'}</p>
        </div>
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
          <p className="text-xs text-gray-400">Upload your ID to a hosting service (e.g. Imgur, Google Drive) and paste the direct link below.</p>
          <div className="space-y-2">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm"
            >
              <option value="">Select ID type...</option>
              {PASSENGER_DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input
              type="url"
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
              placeholder="https://example.com/id-front.jpg"
              className="w-full h-10 px-3 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm"
            />
            <input
              type="url"
              value={selfieUrl}
              onChange={(e) => setSelfieUrl(e.target.value)}
              placeholder="https://example.com/selfie.jpg (optional)"
              className="w-full h-10 px-3 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm"
            />
          </div>
          <button
            onClick={submitKyc}
            disabled={submittingKyc || !docType || !docUrl}
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

      {/* Saved places */}
      {places.length > 0 && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-triq-cyan" />
            <h3 className="text-sm font-semibold text-white">Saved Places</h3>
          </div>
          <div className="space-y-2">
            {places.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className="text-triq-cyan font-medium">{p.label}</span>
                <span className="text-gray-400 text-xs truncate">{p.address}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
