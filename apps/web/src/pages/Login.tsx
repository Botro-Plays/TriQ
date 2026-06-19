import { useState, useRef, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { auth, RecaptchaVerifier } from '../lib/firebase';
import { signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
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
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const setupRecaptcha = useCallback(() => {
    if (recaptchaRef.current) return;
    recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {},
      'expired-callback': () => {},
    });
  }, []);

  const sendOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const formatted = phone.startsWith('+') ? phone : '+63' + phone.replace(/^0/, '');
      // Test mode: no reCAPTCHA needed for test numbers
      if (auth.settings.appVerificationDisabledForTesting) {
        confirmationRef.current = await (signInWithPhoneNumber as any)(auth, formatted, undefined);
      } else {
        setupRecaptcha();
        confirmationRef.current = await signInWithPhoneNumber(auth, formatted, recaptchaRef.current!);
      }
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
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

  const selectRole = async (role: UserRole) => {
    setLoading(true);
    try {
      const idToken = (window as any).__pendingIdToken;
      if (!idToken) throw new Error('Session expired');
      const { data } = await api.post('/auth/verify-token', { idToken, role, phone });
      setAuth(data.token, data.user);
      if (data.user.role === 'PASSENGER') navigate('/passenger');
      else if (data.user.role === 'DRIVER') navigate('/driver');
      else navigate('/admin');
    } catch (err: any) {
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

      <div id="recaptcha-container" style={{ position: 'absolute', top: -9999, left: -9999, opacity: 0 }} />

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
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <div className="space-y-3">
            {ROLES.map((r) => (
              <button
                key={r.value}
                onClick={() => selectRole(r.value)}
                disabled={loading}
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
