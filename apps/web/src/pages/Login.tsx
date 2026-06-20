import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { auth, RecaptchaVerifier } from '../lib/firebase';
import { signInWithPhoneNumber, ConfirmationResult, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { api } from '../lib/api';

type UserRole = 'PASSENGER' | 'DRIVER' | 'OWNER' | 'STAFF';

const ROLES: { label: string; value: UserRole; description: string; icon: string }[] = [
  { label: 'Passenger', value: 'PASSENGER', description: 'Book tricycle rides', icon: 'M' },
  { label: 'Driver', value: 'DRIVER', description: 'Accept ride requests & earn', icon: 'D' },
  { label: 'Staff', value: 'STAFF', description: 'Admin dashboard access', icon: 'S' },
  { label: 'Owner', value: 'OWNER', description: 'Full admin control', icon: 'O' },
];

function TriQLogo({ className = '' }: { className?: string }) {
  return (
    <img
      src="/logo-tricycle.png?v=2"
      alt="TriQ Tricycle"
      className={`object-contain rounded-full ${className}`}
      draggable={false}
    />
  );
}

export default function Login() {
  const [phone, setPhone] = useState('+63');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp' | 'role'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shakeError, setShakeError] = useState(false);
  const [needsPhone, setNeedsPhone] = useState(false);
  const [ownerClaimed, setOwnerClaimed] = useState(true);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/auth/owner-exists')
      .then((res) => setOwnerClaimed(res.data.ownerClaimed))
      .catch(() => setOwnerClaimed(true));
  }, []);

  const showError = (msg: string) => {
    setError(msg);
    setShakeError(true);
    setTimeout(() => setShakeError(false), 500);
  };

  const availableRoles = ownerClaimed
    ? ROLES.filter((r) => r.value !== 'OWNER')
    : ROLES;

  const isPhoneValid = phone.replace('+63', '').replace(/\D/g, '').length >= 10;

  const sendOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const formatted = phone.startsWith('+') ? phone : '+63' + phone.replace(/^0/, '');
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
        recaptchaRef.current = null;
      }
      const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {},
        'expired-callback': () => {},
      });
      recaptchaRef.current = verifier;
      await verifier.render();
      confirmationRef.current = await signInWithPhoneNumber(auth, formatted, verifier);
      setStep('otp');
    } catch (err: any) {
      showError(err.message || 'Failed to send OTP');
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
        recaptchaRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const attemptAutoLogin = async (idToken: string) => {
    try {
      const { data } = await api.post('/auth/verify-token', { idToken });
      setAuth(data.token, data.user);
      if (data.user.role === 'PASSENGER') navigate('/passenger');
      else if (data.user.role === 'DRIVER') navigate('/driver');
      else navigate('/admin');
      return true;
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data?.code === 'PHONE_REQUIRED') {
        setNeedsPhone(true);
        (window as any).__pendingIdToken = idToken;
        setStep('role');
        return false;
      }
      // New user — show role selection
      (window as any).__pendingIdToken = idToken;
      setStep('role');
      return false;
    }
  };

  const verifyOtp = async () => {
    setError('');
    setLoading(true);
    try {
      if (!confirmationRef.current) throw new Error('No OTP sent');
      const result = await confirmationRef.current.confirm(otp);
      const idToken = await result.user.getIdToken();
      await attemptAutoLogin(idToken);
    } catch (err: any) {
      showError(err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      const hasPhone = !!result.user.phoneNumber;
      if (!hasPhone) {
        setNeedsPhone(true);
        setPhone('+63');
      }
      await attemptAutoLogin(idToken);
    } catch (err: any) {
      showError(err.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const selectRole = async (role: UserRole) => {
    setLoading(true);
    try {
      const idToken = (window as any).__pendingIdToken;
      if (!idToken) throw new Error('Session expired');
      const payload: any = { idToken, role };
      if (needsPhone) {
        const formatted = phone.startsWith('+') ? phone : '+63' + phone.replace(/^0/, '');
        payload.phone = formatted;
      }
      const { data } = await api.post('/auth/verify-token', payload);
      setAuth(data.token, data.user);
      if (data.user.role === 'PASSENGER') navigate('/passenger');
      else if (data.user.role === 'DRIVER') navigate('/driver');
      else navigate('/admin');
    } catch (err: any) {
      if (err.response?.data?.code === 'PHONE_REQUIRED') {
        showError('Please enter your phone number');
        setNeedsPhone(true);
        setStep('role');
        return;
      }
      showError(err.response?.data?.error || err.message);
      setStep('phone');
    } finally {
      setLoading(false);
      delete (window as any).__pendingIdToken;
    }
  };

  return (
    <div className="min-h-screen bg-triq-dark flex flex-col items-center justify-center px-5 py-8">
      {/* Logo + Branding */}
      <div className="flex flex-col items-center mb-8">
        <TriQLogo className="w-20 h-20 mb-4 animate-pulse" />
        <h1 className="text-5xl font-extrabold tracking-tight">
          <span className="text-triq-yellow">Tri</span>
          <span className="text-triq-cyan">Q</span>
        </h1>
        <p className="text-gray-300 text-sm mt-2 text-center leading-relaxed">
          Tricycle Booking in Digos City<br />
          <span className="text-triq-cyan/70">Padulong na! Booking made easy.</span>
        </p>
      </div>

      <div id="recaptcha-container" />

      {/* Card Container */}
      <div className={`w-full max-w-sm bg-triq-slate rounded-2xl border border-triq-light/20 shadow-neon-sm p-6 ${shakeError ? 'animate-shake' : ''}`}>

        {step === 'phone' && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Mobile Number
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+63 912 345 6789"
                className="w-full h-12 px-4 rounded-xl bg-triq-dark border border-triq-light/30 text-white placeholder-gray-500 text-base
                  focus:border-triq-cyan focus:ring-2 focus:ring-triq-cyan/20 focus:outline-none transition-all"
              />
              <p className="text-[11px] text-gray-400 mt-1.5">
                We'll send a 6-digit verification code
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={sendOtp}
              disabled={loading || !isPhoneValid}
              className="w-full h-12 rounded-xl bg-triq-yellow text-triq-dark font-bold text-base
                active:scale-[0.97] transition-transform
                hover:shadow-neon-yellow disabled:opacity-40 disabled:cursor-not-allowed
                flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="inline-block w-5 h-5 border-2 border-triq-dark/30 border-t-triq-dark rounded-full animate-spin" />
              ) : (
                'Send OTP'
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-triq-light/20" />
              <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-triq-light/20" />
            </div>

            {/* Google Button */}
            <button
              onClick={signInWithGoogle}
              disabled={loading}
              className="w-full h-12 rounded-xl bg-white text-triq-dark font-semibold text-sm
                active:scale-[0.97] transition-transform
                hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed
                flex items-center justify-center gap-2.5"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </button>
          </div>
        )}

        {step === 'otp' && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                className="w-full h-12 px-4 rounded-xl bg-triq-dark border border-triq-light/30 text-white placeholder-gray-500 text-center text-lg font-mono tracking-[0.5em]
                  focus:border-triq-cyan focus:ring-2 focus:ring-triq-cyan/20 focus:outline-none transition-all"
              />
              <p className="text-[11px] text-gray-400 mt-1.5 text-center">
                Sent to {phone}
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={verifyOtp}
              disabled={loading || otp.length < 6}
              className="w-full h-12 rounded-xl bg-triq-yellow text-triq-dark font-bold text-base
                active:scale-[0.97] transition-transform
                hover:shadow-neon-yellow disabled:opacity-40 disabled:cursor-not-allowed
                flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="inline-block w-5 h-5 border-2 border-triq-dark/30 border-t-triq-dark rounded-full animate-spin" />
              ) : (
                'Verify Code'
              )}
            </button>

            <button
              onClick={() => setStep('phone')}
              className="w-full text-sm text-gray-400 hover:text-triq-cyan transition-colors py-1"
            >
              Change phone number
            </button>
          </div>
        )}

        {step === 'role' && (
          <div className="space-y-5">
            <div className="text-center">
              <h2 className="text-lg font-bold text-white">Kinsa ka?</h2>
              <p className="text-sm text-gray-400 mt-1">Select your role to continue</p>
            </div>

            {needsPhone && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Phone Number <span className="text-triq-yellow">*</span>
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+63 912 345 6789"
                  className="w-full h-12 px-4 rounded-xl bg-triq-dark border border-triq-light/30 text-white placeholder-gray-500 text-base
                    focus:border-triq-cyan focus:ring-2 focus:ring-triq-cyan/20 focus:outline-none transition-all"
                />
                <p className="text-[11px] text-gray-400">Required for ride bookings</p>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-2.5">
              {availableRoles.map((r) => (
                <button
                  key={r.value}
                  onClick={() => selectRole(r.value)}
                  disabled={loading || (needsPhone && !phone.replace('+63', '').replace(/\D/g, '').length)}
                  className="w-full group relative flex items-center gap-4 p-4 rounded-xl
                    bg-triq-dark border border-triq-light/20
                    hover:border-triq-cyan hover:shadow-neon-sm
                    active:scale-[0.98] transition-all
                    disabled:opacity-40 disabled:cursor-not-allowed text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-triq-light/10 flex items-center justify-center text-triq-cyan font-bold text-sm shrink-0
                    group-hover:bg-triq-cyan/20 transition-colors">
                    {r.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold text-sm">{r.label}</div>
                    <div className="text-xs text-gray-400 truncate">{r.description}</div>
                  </div>
                  <svg className="w-4 h-4 text-gray-500 group-hover:text-triq-cyan transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
