import { useAuthStore } from '../../stores/authStore';
import { Phone, Car, Star, Shield } from 'lucide-react';

export default function DriverProfile() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-triq-yellow">Driver Profile</h2>

      <div className="card p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-triq-yellow/20 flex items-center justify-center text-triq-yellow font-bold text-2xl">
          {user?.phoneNumber?.charAt(user.phoneNumber.length - 1) || '?'}
        </div>
        <div>
          <p className="text-white font-semibold text-lg">{user?.phoneNumber || 'Unknown'}</p>
          <p className="text-gray-400 text-sm">Driver</p>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Phone size={18} className="text-triq-cyan" />
          <div>
            <p className="text-xs text-gray-400">Phone</p>
            <p className="text-white text-sm">{user?.phoneNumber || 'Not set'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Car size={18} className="text-triq-cyan" />
          <div>
            <p className="text-xs text-gray-400">Vehicle</p>
            <p className="text-white text-sm">Not configured</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Star size={18} className="text-triq-cyan" />
          <div>
            <p className="text-xs text-gray-400">Rating</p>
            <p className="text-white text-sm">5.0 (0 reviews)</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Shield size={18} className="text-triq-cyan" />
          <div>
            <p className="text-xs text-gray-400">KYC Status</p>
            <p className="text-white text-sm">Pending Review</p>
          </div>
        </div>
      </div>
    </div>
  );
}
