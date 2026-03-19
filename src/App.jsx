import { Routes, Route, Navigate, useRouteError } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import { PlanProvider } from '@/context/PlanContext';
import { UpgradeProvider } from '@/components/Upgrade';
import Layout from '@/components/layout/Layout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import VerifyEmail from '@/pages/VerifyEmail';
import AcceptInvite from '@/pages/AcceptInvite';
import Dashboard from '@/pages/Dashboard';
import Contacts from '@/pages/Contacts';
import ContactDetail from '@/pages/ContactDetail';
import Pipeline from '@/pages/Pipeline';
import DealDetail from '@/pages/DealDetail';
import Tasks from '@/pages/Tasks';
import Automations from '@/pages/Automations';
import Settings from '@/pages/Settings';

function RouteError() {
  const error = useRouteError();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <p className="text-lg font-semibold">Something went wrong</p>
      <p className="text-sm text-muted-foreground">{error?.message || 'An unexpected error occurred'}</p>
      <a href="/" className="text-sm text-primary hover:underline">Go back home</a>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/" element={
        <ProtectedRoute>
          <SocketProvider>
            <PlanProvider>
              <UpgradeProvider>
                <Layout />
              </UpgradeProvider>
            </PlanProvider>
          </SocketProvider>
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="contacts/:id" element={<ContactDetail />} errorElement={<RouteError />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="deals/:id" element={<DealDetail />} errorElement={<RouteError />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="automations" element={<Automations />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/pipeline" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}