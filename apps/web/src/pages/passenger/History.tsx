import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../lib/api';
import { History, MapPin, Navigation, Star, FlagTriangleRight, RefreshCw, ThumbsUp, ThumbsDown, X } from 'lucide-react';

interface RideHistoryItem {
  id: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  estimatedFare: number;
  finalFare: number | null;
  createdAt: string;
  completedAt: string | null;
  driver: { id: string; name: string; plateNumber: string } | null;
  review: { id: string; rating: number; thumbsUp: boolean | null; comment: string | null } | null;
}

export default function PassengerHistory() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [rides, setRides] = useState<RideHistoryItem[]>([]);
  const [, setPassengerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rateRideId, setRateRideId] = useState<string | null>(null);
  const [reportRideId, setReportRideId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [thumbsUp, setThumbsUp] = useState<boolean | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reportCategory, setReportCategory] = useState('');
  const [reportDesc, setReportDesc] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const fetchRides = () => {
    if (!user) return;
    api.get('/passengers', { params: { userId: user.id } })
      .then((res) => {
        setPassengerId(res.data.id);
        return api.get(`/passengers/${res.data.id}/rides`);
      })
      .then((res) => setRides(res.data.rides))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRides(); }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-8 h-8 border-2 border-triq-cyan/30 border-t-triq-cyan rounded-full animate-spin" />
      </div>
    );
  }

  const formatPeso = (c: number) => `₱${(c / 100).toFixed(0)}`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

  const submitReview = async () => {
    if (rating === 0 || !rateRideId) return;
    setReviewSubmitting(true);
    try {
      await api.post(`/rides/${rateRideId}/review`, { rating, thumbsUp, comment: reviewComment });
      setRateRideId(null);
      setRating(0);
      setThumbsUp(null);
      setReviewComment('');
      fetchRides();
    } catch {} finally {
      setReviewSubmitting(false);
    }
  };

  const submitReport = async () => {
    if (!reportCategory || !reportRideId) return;
    setReportSubmitting(true);
    try {
      await api.post('/reports', { rideId: reportRideId, category: reportCategory, description: reportDesc });
      setReportRideId(null);
      setReportCategory('');
      setReportDesc('');
    } catch {} finally {
      setReportSubmitting(false);
    }
  };

  const rebook = (ride: RideHistoryItem) => {
    navigate('/passenger', {
      state: {
        pickup: { lat: ride.pickupLat, lng: ride.pickupLng, address: ride.pickupAddress },
        dropoff: { lat: ride.dropoffLat, lng: ride.dropoffLng, address: ride.dropoffAddress },
      },
    });
  };

  const reportCategories = [
    'Unsafe driving',
    'Overcharging / fare dispute',
    'Rude behavior',
    'Vehicle issue',
    'No-show / abandoned ride',
    'Harassment',
    'Other',
  ];

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

              {/* Existing review display */}
              {ride.review && (
                <div className="flex items-center gap-2 pt-1 border-t border-triq-light/10">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} size={12} className={n <= ride.review!.rating ? 'text-triq-yellow fill-triq-yellow' : 'text-gray-600'} />
                    ))}
                  </div>
                  {ride.review.thumbsUp !== null && (
                    ride.review.thumbsUp
                      ? <ThumbsUp size={12} className="text-green-400" />
                      : <ThumbsDown size={12} className="text-red-400" />
                  )}
                  {ride.review.comment && (
                    <span className="text-xs text-gray-400 italic truncate">"{ride.review.comment}"</span>
                  )}
                </div>
              )}

              {/* Action buttons for completed rides */}
              {ride.status === 'COMPLETED' && ride.driver && (
                <div className="flex gap-2 pt-1 border-t border-triq-light/10">
                  {!ride.review && (
                    <button
                      onClick={() => { setRateRideId(ride.id); setRating(0); setThumbsUp(null); setReviewComment(''); }}
                      className="flex-1 h-8 rounded-lg bg-triq-yellow/10 text-triq-yellow border border-triq-yellow/30 text-xs font-medium flex items-center justify-center gap-1"
                    >
                      <Star size={12} /> Rate
                    </button>
                  )}
                  <button
                    onClick={() => { setReportRideId(ride.id); setReportCategory(''); setReportDesc(''); }}
                    className="h-8 px-3 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/30 text-xs font-medium flex items-center justify-center gap-1"
                  >
                    <FlagTriangleRight size={12} /> Report
                  </button>
                  <button
                    onClick={() => rebook(ride)}
                    className="flex-1 h-8 rounded-lg bg-triq-cyan/10 text-triq-cyan border border-triq-cyan/30 text-xs font-medium flex items-center justify-center gap-1"
                  >
                    <RefreshCw size={12} /> Re-book
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Rate driver modal */}
      {rateRideId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setRateRideId(null)}>
          <div className="bg-triq-slate rounded-xl border border-triq-light/30 p-5 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Rate your driver</h3>
              <button onClick={() => setRateRideId(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="flex gap-1 justify-center">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)} className="active:scale-90 transition-transform">
                  <Star size={32} className={n <= rating ? 'text-triq-yellow fill-triq-yellow' : 'text-gray-600'} />
                </button>
              ))}
            </div>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setThumbsUp(true)} className={`px-4 h-10 rounded-lg flex items-center gap-1.5 text-sm font-medium ${thumbsUp === true ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-triq-light/10 text-gray-400'}`}>
                <ThumbsUp size={14} /> Good
              </button>
              <button onClick={() => setThumbsUp(false)} className={`px-4 h-10 rounded-lg flex items-center gap-1.5 text-sm font-medium ${thumbsUp === false ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-triq-light/10 text-gray-400'}`}>
                <ThumbsDown size={14} /> Bad
              </button>
            </div>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Leave a comment (optional)"
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm resize-none"
            />
            <button
              onClick={submitReview}
              disabled={rating === 0 || reviewSubmitting}
              className="w-full h-10 rounded-lg bg-triq-yellow text-triq-dark font-bold text-sm disabled:opacity-40"
            >
              {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </div>
      )}

      {/* Report modal */}
      {reportRideId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setReportRideId(null)}>
          <div className="bg-triq-slate rounded-xl border border-triq-light/30 p-5 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Report an issue</h3>
              <button onClick={() => setReportRideId(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-1.5">
              {reportCategories.map((c) => (
                <label key={c} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="reportCat" value={c} checked={reportCategory === c} onChange={() => setReportCategory(c)} className="accent-orange-400" />
                  <span className="text-sm text-white">{c}</span>
                </label>
              ))}
            </div>
            <textarea
              value={reportDesc}
              onChange={(e) => setReportDesc(e.target.value)}
              placeholder="Describe what happened (optional)"
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm resize-none"
            />
            <button
              onClick={submitReport}
              disabled={!reportCategory || reportSubmitting}
              className="w-full h-10 rounded-lg bg-orange-500 text-white font-bold text-sm disabled:opacity-40"
            >
              {reportSubmitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
