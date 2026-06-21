import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Star, ThumbsUp, ThumbsDown } from 'lucide-react';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  thumbsUp: boolean | null;
  createdAt: string;
  from: { name: string };
  to: { name: string; plateNumber: string };
  ride: { id: string; pickupAddress: string; dropoffAddress: string };
}

interface RatingData {
  reviews: Review[];
  total: number;
  page: number;
  pages: number;
  avgRating: number;
}

export default function AdminRatings() {
  const [data, setData] = useState<RatingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [maxRating, setMaxRating] = useState(0);

  useEffect(() => {
    setLoading(true);
    api.get('/admin/ratings', { params: { page, minRating: maxRating } })
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, maxRating]);

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-triq-yellow">Ratings & Reviews</h1>

      {data && (
        <div className="bg-gradient-to-r from-triq-slate to-triq-dark rounded-xl border border-triq-yellow/20 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Average Rating</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-bold text-triq-yellow">{data.avgRating.toFixed(1)}</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} size={16} className={n <= Math.round(data.avgRating) ? 'text-triq-yellow fill-triq-yellow' : 'text-gray-600'} />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => { setMaxRating(0); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${maxRating === 0 ? 'bg-triq-cyan/20 text-triq-cyan' : 'bg-triq-light/10 text-gray-400'}`}
        >
          All
        </button>
        <button
          onClick={() => { setMaxRating(2); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${maxRating === 2 ? 'bg-red-500/20 text-red-400' : 'bg-triq-light/10 text-gray-400'}`}
        >
          Low (1-2★)
        </button>
        <button
          onClick={() => { setMaxRating(3); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${maxRating === 3 ? 'bg-orange-500/20 text-orange-400' : 'bg-triq-light/10 text-gray-400'}`}
        >
          Mid (1-3★)
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-triq-cyan/30 border-t-triq-cyan rounded-full animate-spin" />
        </div>
      ) : !data || data.reviews.length === 0 ? (
        <div className="card p-6 text-center">
          <Star size={32} className="text-gray-600 mx-auto mb-2" />
          <p className="text-white font-semibold">No reviews found</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {data.reviews.map((rev) => (
              <div key={rev.id} className="card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} size={12} className={n <= rev.rating ? 'text-triq-yellow fill-triq-yellow' : 'text-gray-600'} />
                      ))}
                    </div>
                    {rev.thumbsUp !== null && (
                      rev.thumbsUp
                        ? <ThumbsUp size={12} className="text-green-400" />
                        : <ThumbsDown size={12} className="text-red-400" />
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{formatDate(rev.createdAt)}</span>
                </div>
                <div className="text-xs text-gray-400">
                  {rev.from.name} → {rev.to.name} ({rev.to.plateNumber})
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {rev.ride.pickupAddress} → {rev.ride.dropoffAddress}
                </div>
                {rev.comment && (
                  <p className="text-xs text-gray-300 italic pt-1 border-t border-triq-light/10">"{rev.comment}"</p>
                )}
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
