import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';

type UserRole = 'PASSENGER' | 'DRIVER' | 'OWNER' | 'STAFF';

const ROLES: { label: string; value: UserRole; description: string }[] = [
  { label: 'Passenger', value: 'PASSENGER', description: 'Book tricycle rides' },
  { label: 'Driver', value: 'DRIVER', description: 'Accept ride requests & earn' },
  { label: 'Staff', value: 'STAFF', description: 'Admin dashboard access' },
  { label: 'Owner', value: 'OWNER', description: 'Full admin control' },
];

export default function Login() {
  const setRole = useAuthStore((s) => s.setRole);
  const navigate = useNavigate();

  const handleSelect = (role: UserRole) => {
    setRole(role);
    if (role === 'PASSENGER') navigate('/passenger');
    else if (role === 'DRIVER') navigate('/driver');
    else navigate('/admin');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-triq-dark p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-triq-yellow drop-shadow-neon-yellow">TriQ</h1>
        <p className="text-gray-400 mt-2">Tricycle Booking for Digos City</p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        {ROLES.map((r) => (
          <button
            key={r.value}
            onClick={() => handleSelect(r.value)}
            className="w-full p-4 rounded-xl bg-triq-slate border border-triq-light hover:border-triq-cyan hover:shadow-neon transition-all text-left"
          >
            <div className="text-white font-semibold">{r.label}</div>
            <div className="text-sm text-gray-400">{r.description}</div>
          </button>
        ))}
      </div>

      <p className="mt-8 text-xs text-gray-500">
        This is a dev login. Firebase phone auth will replace this flow.
      </p>
    </div>
  );
}
