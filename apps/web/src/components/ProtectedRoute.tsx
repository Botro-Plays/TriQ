import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

type UserRole = 'PASSENGER' | 'DRIVER' | 'OWNER' | 'STAFF';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { role, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || !role) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(role as UserRole)) {
    // Redirect to appropriate home based on role
    if (role === 'PASSENGER') return <Navigate to="/passenger" replace />;
    if (role === 'DRIVER') return <Navigate to="/driver" replace />;
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
