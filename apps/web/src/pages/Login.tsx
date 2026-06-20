import { useState, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { auth, RecaptchaVerifier } from '../lib/firebase';
import { signInWithPhoneNumber, ConfirmationResult, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { api } from '../lib/api';

type UserRole = 'PASSENGER' | 'DRIVER' | 'OWNER' | 'STAFF';

const ROLES: { label: string; value: UserRole; description: string }[] = [
  { label: 'Passenger', value: 'PASSENGER', description: 'Book tricycle rides' },
  { label: 'Driver', value: 'DRIVER', description: 'Accept ride requests & earn' },
  { label: 'Staff', value: 'STAFF', description: 'Admin dashboard access' },
  { label: 'Owner', value: 'OWNER', description: 'Full admin control' },
];

export default function Login() {
  const [phone, setPhone] = useState('+63');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp' | 'role'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsPhone, setNeedsPhone] = useState(false);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const sendOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const formatted = phone.startsWith('+') ? phone : '+63' + phone.replace(/^0/, '');

      // Clear any stale verifier
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
        recaptchaRef.current = null;
      }

      // Create and explicitly render invisible reCAPTCHA
      const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: (response: string) => {
          console.log('[reCAPTCHA] solved:', response ? 'token received' : 'empty');
        },
        'expired-callback': () => {
          console.warn('[reCAPTCHA] expired, will retry');
        },
      });

      recaptchaRef.current = verifier;
      await verifier.render();
      console.log('[reCAPTCHA] rendered');

      confirmationRef.current = await signInWithPhoneNumber(auth, formatted, verifier);
      setStep('otp');
    } catch (err: any) {
      console.error('sendOtp error:', err);
      setError(err.message || 'Failed to send OTP');
      // Clean up on error
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
        recaptchaRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError('');
    setLoading(true);
    try {
      if (!confirmationRef.current) throw new Error('No OTP sent');
      const result = await confirmationRef.current.confirm(otp);
      const idToken = await result.user.getIdToken();
      // Store Firebase ID token temporarily; backend will create user and return TriQ JWT
      setStep('role');
      // Store idToken for role selection step
      (window as any).__pendingIdToken = idToken;
    } catch (err: any) {
      setError(err.message || 'Invalid OTP');
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

      (window as any).__pendingIdToken = idToken;
      setNeedsPhone(!hasPhone);
      if (!hasPhone) {
        setPhone('+63');
      }
      setStep('role');
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setError(err.message || 'Google sign-in failed');
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
        setError('Please enter your phone number');
        setNeedsPhone(true);
        setStep('role');
        return;
      }
      setError(err.response?.data?.error || err.message);
      setStep('phone');
    } finally {
      setLoading(false);
      delete (window as any).__pendingIdToken;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-triq-dark p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-triq-yellow drop-shadow-neon-yellow">TriQ</h1>
        <p className="text-gray-400 mt-2">Tricycle Booking for Digos City</p>
      </div>

      <div id="recaptcha-container" />

      {step === 'phone' && (
        <div className="w-full max-w-sm space-y-4">
          <label className="block text-sm text-gray-300">Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+63 912 345 6789"
            className="w-full p-3 rounded-lg bg-triq-slate border border-triq-light text-white focus:border-triq-cyan focus:outline-none"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={sendOtp}
            disabled={loading}
            className="w-full p-3 rounded-lg bg-triq-cyan text-triq-dark font-bold hover:shadow-neon transition-all disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send OTP'}
          </button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-triq-light/30" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-triq-dark text-gray-500">or</span>
            </div>
          </div>

          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="w-full p-3 rounded-lg bg-white text-gray-800 font-semibold hover:bg-gray-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
        <div className="w-full max-w-sm space-y-4">
          <label className="block text-sm text-gray-300">Enter OTP</label>
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="123456"
            maxLength={6}
            className="w-full p-3 rounded-lg bg-triq-slate border border-triq-light text-white focus:border-triq-cyan focus:outline-none"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={verifyOtp}
            disabled={loading}
            className="w-full p-3 rounded-lg bg-triq-cyan text-triq-dark font-bold hover:shadow-neon transition-all disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
          <button
            onClick={() => setStep('phone')}
            className="w-full text-sm text-gray-400 hover:text-white"
          >
            Change phone number
          </button>
        </div>
      )}

      {step === 'role' && (
        <div className="w-full max-w-sm space-y-4">
          <p className="text-center text-gray-300">Select your role</p>
          {needsPhone && (
            <div className="space-y-2">
              <label className="block text-sm text-gray-300">Phone Number (required for rides)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+63 912 345 6789"
                className="w-full p-3 rounded-lg bg-triq-slate border border-triq-light text-white focus:border-triq-cyan focus:outline-none"
              />
            </div>
          )}
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <div className="space-y-3">
            {ROLES.map((r) => (
              <button
                key={r.value}
                onClick={() => selectRole(r.value)}
                disabled={loading || (needsPhone && !phone.replace('+63', '').replace(/^0/, ''))}
                className="w-full p-4 rounded-xl bg-triq-slate border border-triq-light hover:border-triq-cyan hover:shadow-neon transition-all text-left disabled:opacity-50"
              >
                <div className="text-white font-semibold">{r.label}</div>
                <div className="text-sm text-gray-400">{r.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
