import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';

// Passenger pages
import PassengerHome from './pages/passenger/Home';
import PassengerMap from './pages/passenger/Map';
import PassengerProfile from './pages/passenger/Profile';
import PassengerHistory from './pages/passenger/History';

// Driver pages
import DriverHome from './pages/driver/Home';
import DriverEarnings from './pages/driver/Earnings';
import DriverProfile from './pages/driver/Profile';

// Shared pages
import Leaderboard from './pages/shared/Leaderboard';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminKycQueue from './pages/admin/KycQueue';
import AdminDrivers from './pages/admin/Drivers';
import AdminRides from './pages/admin/Rides';
import AdminReports from './pages/admin/Reports';
import AdminSubscriptions from './pages/admin/Subscriptions';
import AdminTips from './pages/admin/Tips';
import AdminPassengers from './pages/admin/Passengers';
import AdminRatings from './pages/admin/Ratings';
import AdminMore from './pages/admin/More';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login — no layout */}
        <Route path="/login" element={<Login />} />

        {/* All other routes wrapped in Layout */}
        <Route element={<Layout />}>
          {/* Redirect root to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Passenger routes */}
          <Route
            path="/passenger"
            element={
              <ProtectedRoute allowedRoles={['PASSENGER']}>
                <PassengerHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/passenger/map"
            element={
              <ProtectedRoute allowedRoles={['PASSENGER']}>
                <PassengerMap />
              </ProtectedRoute>
            }
          />
          <Route
            path="/passenger/profile"
            element={
              <ProtectedRoute allowedRoles={['PASSENGER']}>
                <PassengerProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/passenger/history"
            element={
              <ProtectedRoute allowedRoles={['PASSENGER']}>
                <PassengerHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/passenger/leaderboard"
            element={
              <ProtectedRoute allowedRoles={['PASSENGER']}>
                <Leaderboard />
              </ProtectedRoute>
            }
          />

          {/* Driver routes */}
          <Route
            path="/driver"
            element={
              <ProtectedRoute allowedRoles={['DRIVER']}>
                <DriverHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/driver/earnings"
            element={
              <ProtectedRoute allowedRoles={['DRIVER']}>
                <DriverEarnings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/driver/profile"
            element={
              <ProtectedRoute allowedRoles={['DRIVER']}>
                <DriverProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/driver/leaderboard"
            element={
              <ProtectedRoute allowedRoles={['DRIVER']}>
                <Leaderboard />
              </ProtectedRoute>
            }
          />

          {/* Admin routes — OWNER and STAFF */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'STAFF']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/kyc"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'STAFF']}>
                <AdminKycQueue />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/drivers"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'STAFF']}>
                <AdminDrivers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/rides"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'STAFF']}>
                <AdminRides />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'STAFF']}>
                <AdminReports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/subscriptions"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'STAFF']}>
                <AdminSubscriptions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tips"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'STAFF']}>
                <AdminTips />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/passengers"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'STAFF']}>
                <AdminPassengers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/ratings"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'STAFF']}>
                <AdminRatings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/more"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'STAFF']}>
                <AdminMore />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
