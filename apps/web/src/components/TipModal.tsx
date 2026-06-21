import { useState } from 'react';
import { Heart, X } from 'lucide-react';
import { api } from '../lib/api';

interface TipModalProps {
  open: boolean;
  onClose: () => void;
  rideId?: string;
}

export default function TipModal({ open, onClose, rideId }: TipModalProps) {
  const [tipAmount, setTipAmount] = useState(0);
  const [tipCustom, setTipCustom] = useState('');
  const [tipping, setTipping] = useState(false);
  const [tipSuccess, setTipSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const submit = async () => {
    if (tipAmount < 100) return;
    setTipping(true);
    setError('');
    try {
      const res = await api.post('/tips', {
        amount: tipAmount,
        rideId: rideId || undefined,
      });
      if (res.data.checkoutUrl) {
        window.location.href = res.data.checkoutUrl;
      } else {
        setTipSuccess(true);
        setTimeout(() => {
          setTipSuccess(false);
          setTipAmount(0);
          setTipCustom('');
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create tip');
    } finally {
      setTipping(false);
    }
  };

  const close = () => {
    setTipAmount(0);
    setTipCustom('');
    setError('');
    setTipSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/60 p-4" onClick={close}>
      <div className="bg-triq-slate rounded-xl border border-triq-light/30 p-5 max-w-sm w-full space-y-4 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        {tipSuccess ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center">
              <Heart size={28} className="text-green-400" />
            </div>
            <p className="text-lg font-bold text-white">Thank you!</p>
            <p className="text-sm text-gray-400 text-center">Your tip has been created successfully.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Heart size={18} className="text-triq-cyan" /> Support TriQ
              </h3>
              <button onClick={close} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-400">Support the platform with a small tip. Pay via GCash, Maya, or card.</p>
            <div className="flex gap-2 flex-wrap">
              {[1000, 2000, 5000, 10000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => { setTipAmount(amt); setTipCustom(''); }}
                  className={`px-3 h-9 rounded-lg text-sm font-medium transition-all active:scale-90 ${
                    tipAmount === amt && !tipCustom
                      ? 'bg-triq-cyan text-triq-dark'
                      : 'bg-triq-light/10 text-gray-400 hover:bg-triq-light/20'
                  }`}
                >
                  ₱{(amt / 100).toFixed(0)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">₱</span>
              <input
                type="number"
                min="1"
                value={tipCustom}
                onChange={(e) => {
                  setTipCustom(e.target.value);
                  const parsed = parseInt(e.target.value) || 0;
                  setTipAmount(parsed > 0 ? parsed * 100 : 0);
                }}
                placeholder="Custom amount"
                className="flex-1 h-9 px-3 rounded-lg bg-triq-dark border border-triq-light/30 text-white text-sm focus:border-triq-cyan focus:outline-none"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              onClick={submit}
              disabled={tipping || tipAmount < 100}
              className="w-full h-10 rounded-lg bg-triq-cyan text-triq-dark font-bold text-sm disabled:opacity-40"
            >
              {tipping ? 'Processing...' : `Tip ₱${(tipAmount / 100).toFixed(0)}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
