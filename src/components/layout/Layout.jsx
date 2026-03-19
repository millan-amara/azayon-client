import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useRole } from '@/hooks/useRole';
import { useAuth } from '@/context/AuthContext';
import { X } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { TrialBanner, PlanStatusBanner } from '@/components/PlanBanners';
const PAGE_TITLES = {
  '/': 'Dashboard',
  '/contacts': 'Contacts',
  '/pipeline': 'Pipeline',
  '/tasks': 'Tasks',
  '/automations': 'Automations',
  '/settings': 'Settings',
};

function getTitle(pathname) {
  if (pathname.startsWith('/contacts/')) return 'Contact Detail';
  if (pathname.startsWith('/deals/')) return 'Deal Detail';
  return PAGE_TITLES[pathname] || 'CRM';
}

function VerifyEmailBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [resending, setResending] = useState(false);
  const { user } = useAuth();

  if (dismissed || !user || user.emailVerified) return null;

  const resend = async () => {
    setResending(true);
    try {
      await api.post('/auth/resend-verification', { email: user.email });
      toast.success('Verification email sent — check your inbox');
    } catch {
      toast.error('Failed to resend, please try again');
    } finally {
      setResending(false);
    }
  };

  return (
    <div
      className="flex items-center justify-between gap-4 px-6 py-2 shrink-0"
      style={{ backgroundColor: 'hsl(243 75% 97%)', borderBottom: '1px solid hsl(243 75% 88%)' }}
    >
      <p className="text-xs text-primary">
        📧 Please verify your email address to ensure you don't lose access to your account.{' '}
        <button
          onClick={resend}
          disabled={resending}
          className="font-semibold underline underline-offset-2 hover:opacity-70 transition-opacity disabled:opacity-50"
        >
          {resending ? 'Sending...' : 'Resend email'}
        </button>
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 p-1 rounded hover:bg-primary/10 transition-colors"
        title="Dismiss"
      >
        <X className="w-3.5 h-3.5 text-primary" />
      </button>
    </div>
  );
}

export default function Layout() {
  const location = useLocation();
  const title = getTitle(location.pathname);
  const { isViewer } = useRole();

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-background)' }}>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar title={title} />
        <TrialBanner />
        <PlanStatusBanner />
        <VerifyEmailBanner />
        {isViewer && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-2 shrink-0">
            <span className="text-xs font-medium text-amber-700">
              👁 You have view-only access. Contact your admin to make changes.
            </span>
          </div>
        )}
        <main className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: 'hsl(220 20% 97%)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}