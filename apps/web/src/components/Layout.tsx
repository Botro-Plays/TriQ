import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import {
  Home, Map, User, DollarSign, LayoutDashboard, ShieldCheck,
  Car, FlagTriangleRight, LogOut, Menu, X, History,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

type UserRole = 'PASSENGER' | 'DRIVER' | 'OWNER' | 'STAFF';

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  PASSENGER: [
    { label: 'Home', path: '/passenger', icon: Home },
    { label: 'Map', path: '/passenger/map', icon: Map },
    { label: 'History', path: '/passenger/history', icon: History },
    { label: 'Profile', path: '/passenger/profile', icon: User },
  ],
  DRIVER: [
    { label: 'Home', path: '/driver', icon: Home },
    { label: 'Earnings', path: '/driver/earnings', icon: DollarSign },
    { label: 'Profile', path: '/driver/profile', icon: User },
  ],
  OWNER: [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { label: 'KYC', path: '/admin/kyc', icon: ShieldCheck },
    { label: 'Drivers', path: '/admin/drivers', icon: Car },
    { label: 'Rides', path: '/admin/rides', icon: Map },
    { label: 'Reports', path: '/admin/reports', icon: FlagTriangleRight },
  ],
  STAFF: [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { label: 'KYC', path: '/admin/kyc', icon: ShieldCheck },
    { label: 'Drivers', path: '/admin/drivers', icon: Car },
    { label: 'Rides', path: '/admin/rides', icon: Map },
    { label: 'Reports', path: '/admin/reports', icon: FlagTriangleRight },
  ],
};

const ROLE_LABELS: Record<UserRole, string> = {
  PASSENGER: 'Passenger',
  DRIVER: 'Driver',
  OWNER: 'Owner',
  STAFF: 'Staff',
};

export default function Layout() {
  const { role, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!role) return <Outlet />;

  const items = NAV_ITEMS[role as UserRole] || [];
  const isAdmin = role === 'OWNER' || role === 'STAFF';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === `/${role.toLowerCase().split('_')[0]}` || path === '/admin') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-triq-dark flex flex-col">
      {/* Top header — compact, mobile-friendly */}
      <header className="sticky top-0 z-30 bg-triq-dark/95 backdrop-blur-md border-b border-triq-light/10 safe-top">
        <div className="flex items-center justify-between h-14 px-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5">
            {isAdmin && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-triq-light/10"
              >
                <Menu size={20} className="text-gray-300" />
              </button>
            )}
            <Link to="/" className="flex items-center gap-2">
              <span className="text-lg font-extrabold text-triq-yellow tracking-tight">TriQ</span>
              <span className="text-[10px] font-semibold text-triq-cyan uppercase tracking-wider px-1.5 py-0.5 rounded bg-triq-cyan/10">
                {ROLE_LABELS[role as UserRole]}
              </span>
            </Link>
          </div>

          {/* Desktop nav for non-admin */}
          {!isAdmin && (
            <nav className="hidden sm:flex items-center gap-1">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      isActive(item.path)
                        ? 'bg-triq-cyan/15 text-triq-cyan font-semibold'
                        : 'text-gray-400 hover:text-white hover:bg-triq-light/10'
                    }`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Desktop nav for admin */}
          {isAdmin && (
            <nav className="hidden md:flex items-center gap-1">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      isActive(item.path)
                        ? 'bg-triq-cyan/15 text-triq-cyan font-semibold'
                        : 'text-gray-400 hover:text-white hover:bg-triq-light/10'
                    }`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Admin sidebar overlay (mobile) */}
      {isAdmin && sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="absolute left-0 top-0 bottom-0 w-64 bg-triq-slate border-r border-triq-light/20 safe-top animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-triq-light/10">
              <span className="text-sm font-bold text-white">Admin Menu</span>
              <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-lg hover:bg-triq-light/10">
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <nav className="p-2 space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      isActive(item.path)
                        ? 'bg-triq-cyan/15 text-triq-cyan font-semibold'
                        : 'text-gray-400 hover:text-white hover:bg-triq-light/10'
                    }`}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-20 sm:pb-4">
        <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6 animate-fade-in">
          <Outlet />
        </div>
      </main>

      {/* Bottom navigation — mobile only, passenger/driver */}
      {!isAdmin && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 bg-triq-slate/95 backdrop-blur-md border-t border-triq-light/20 shadow-bottom-nav safe-bottom sm:hidden">
          <div className="flex items-center justify-around h-16 max-w-mobile mx-auto">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                    active ? 'text-triq-cyan' : 'text-gray-500'
                  }`}
                >
                  <Icon size={22} className={active ? 'scale-110 transition-transform' : ''} />
                  <span className={`text-[10px] font-medium ${active ? 'font-bold' : ''}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {/* Bottom navigation — mobile only, admin */}
      {isAdmin && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 bg-triq-slate/95 backdrop-blur-md border-t border-triq-light/20 shadow-bottom-nav safe-bottom md:hidden">
          <div className="flex items-center justify-around h-16 max-w-mobile mx-auto overflow-x-auto">
            {items.slice(0, 5).map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-w-[60px] transition-colors ${
                    active ? 'text-triq-cyan' : 'text-gray-500'
                  }`}
                >
                  <Icon size={20} className={active ? 'scale-110 transition-transform' : ''} />
                  <span className={`text-[9px] font-medium ${active ? 'font-bold' : ''}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
