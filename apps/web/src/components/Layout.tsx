import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

type UserRole = 'PASSENGER' | 'DRIVER' | 'OWNER' | 'STAFF';

const NAV_ITEMS: Record<UserRole, { label: string; path: string }[]> = {
  PASSENGER: [
    { label: 'Home', path: '/passenger' },
    { label: 'Map', path: '/passenger/map' },
    { label: 'Profile', path: '/passenger/profile' },
  ],
  DRIVER: [
    { label: 'Home', path: '/driver' },
    { label: 'Earnings', path: '/driver/earnings' },
    { label: 'Profile', path: '/driver/profile' },
  ],
  OWNER: [
    { label: 'Dashboard', path: '/admin' },
    { label: 'KYC', path: '/admin/kyc' },
    { label: 'Drivers', path: '/admin/drivers' },
    { label: 'Rides', path: '/admin/rides' },
    { label: 'Reports', path: '/admin/reports' },
  ],
  STAFF: [
    { label: 'Dashboard', path: '/admin' },
    { label: 'KYC', path: '/admin/kyc' },
    { label: 'Drivers', path: '/admin/drivers' },
    { label: 'Rides', path: '/admin/rides' },
    { label: 'Reports', path: '/admin/reports' },
  ],
};

export default function Layout() {
  const { role, logout } = useAuthStore();
  const location = useLocation();

  const items = role ? NAV_ITEMS[role as UserRole] || [] : [];

  return (
    <div className="min-h-screen bg-triq-cloud">
      {role && (
        <header className="bg-triq-dark text-white p-4 shadow-neon flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-xl font-bold text-triq-yellow">TriQ</Link>
            <span className="text-xs text-triq-cyan uppercase tracking-wide">{role}</span>
          </div>
          <nav className="flex gap-3 overflow-x-auto">
            {items.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`text-sm px-3 py-1 rounded-lg transition-colors ${
                  location.pathname === item.path
                    ? 'bg-triq-cyan text-triq-dark font-semibold'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={logout}
              className="text-sm px-3 py-1 rounded-lg text-red-400 hover:text-red-300"
            >
              Logout
            </button>
          </nav>
        </header>
      )}
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}
