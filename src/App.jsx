import { Routes, Route, Navigate, useRouteError } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import { PlanProvider } from '@/context/PlanContext';
import { UpgradeProvider } from '@/components/Upgrade';
import Layout from '@/components/layout/Layout';

// ── Eager: auth + the pages reps live in (Pipeline, Contacts, Tasks) ──
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Contacts from '@/pages/Contacts';
import Pipeline from '@/pages/Pipeline';
import Tasks from '@/pages/Tasks';

// ── Lazy: heavy or rarely-visited routes split into separate chunks ──
// Dashboard pulls in recharts (~150kB gz), the single heaviest dep — keeping
// it lazy means recharts only ships when Dashboard or Reports is opened.
const Dashboard       = lazy(() => import('@/pages/Dashboard'));
const ContactDetail   = lazy(() => import('@/pages/ContactDetail'));
const DealDetail      = lazy(() => import('@/pages/DealDetail'));
const VerifyEmail     = lazy(() => import('@/pages/VerifyEmail'));
const AcceptInvite    = lazy(() => import('@/pages/AcceptInvite'));
const Automations     = lazy(() => import('@/pages/Automations'));
const Settings        = lazy(() => import('@/pages/Settings'));
const Documents       = lazy(() => import('@/pages/Documents'));
const DocumentEditor  = lazy(() => import('@/pages/DocumentEditor'));
const PublicDocument  = lazy(() => import('@/pages/PublicDocument'));
const Reports         = lazy(() => import('@/pages/Reports'));
const Customers       = lazy(() => import('@/pages/Customers'));

// Superadmin (cross-tenant) — only ever loaded for platform admins.
const AdminLayout     = lazy(() => import('@/pages/admin/AdminLayout'));
const AdminOverview   = lazy(() => import('@/pages/admin/Overview'));
const AdminOrgs       = lazy(() => import('@/pages/admin/Orgs'));
const AdminUsers      = lazy(() => import('@/pages/admin/Users'));
const AdminDeals      = lazy(() => import('@/pages/admin/Deals'));
const AdminContacts   = lazy(() => import('@/pages/admin/Contacts'));
const AdminBilling    = lazy(() => import('@/pages/admin/Billing'));
const AdminSystem     = lazy(() => import('@/pages/admin/System'));

// Centered spinner while a lazy chunk is loading.
function RouteFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

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
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/i/:token" element={<PublicDocument />} />
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
        <Route path="customers" element={<Customers />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="deals/:id" element={<DealDetail />} errorElement={<RouteError />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="documents" element={<Documents />} />
        <Route path="documents/new" element={<DocumentEditor />} />
        <Route path="documents/:id" element={<DocumentEditor />} errorElement={<RouteError />} />
        <Route path="reports" element={<Reports />} />
        <Route path="automations" element={<Automations />} />
        <Route path="settings" element={<Settings />} />
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="orgs" element={<AdminOrgs />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="deals" element={<AdminDeals />} />
          <Route path="contacts" element={<AdminContacts />} />
          <Route path="billing" element={<AdminBilling />} />
          <Route path="system" element={<AdminSystem />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/pipeline" replace />} />
    </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}