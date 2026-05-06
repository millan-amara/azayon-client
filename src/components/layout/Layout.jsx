import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import { useRole } from '@/hooks/useRole';
import { useAuth } from '@/context/AuthContext';
import { X, Smartphone } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { TrialBanner, PlanStatusBanner } from '@/components/PlanBanners';
import SearchModal from '@/components/SearchModal';
import OnboardingWizard from '@/components/OnboardingWizard';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { onInstallAvailableChange, triggerInstall } from '@/lib/pwa';

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/contacts': 'Contacts',
  '/customers': 'Customers',
  '/pipeline': 'Pipeline',
  '/tasks': 'Tasks',
  '/documents': 'Invoices & Quotes',
  '/reports': 'Reports',
  '/automations': 'Automations',
  '/settings': 'Settings',
  '/admin': 'Superadmin · Overview',
  '/admin/orgs': 'Superadmin · Orgs',
  '/admin/users': 'Superadmin · Users',
  '/admin/deals': 'Superadmin · Deals',
  '/admin/contacts': 'Superadmin · Contacts',
  '/admin/billing': 'Superadmin · Billing',
  '/admin/system': 'Superadmin · System',
};

function getTitle(pathname) {
  if (pathname.startsWith('/contacts/')) return 'Contact Detail';
  if (pathname.startsWith('/deals/')) return 'Deal Detail';
  if (pathname === '/documents/new' || pathname.startsWith('/documents/')) return 'Document';
  return PAGE_TITLES[pathname] || 'Azayon';
}

function InstallBanner() {
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('installBannerDismissed') === '1'
  );

  useEffect(() => onInstallAvailableChange(setAvailable), []);

  if (!available || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem('installBannerDismissed', '1');
  };

  return (
    <div
      className="flex items-center justify-between gap-4 px-4 py-2 shrink-0"
      style={{ backgroundColor: 'hsl(243 75% 97%)', borderBottom: '1px solid hsl(243 75% 88%)' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Smartphone className="w-3.5 h-3.5 text-primary shrink-0" />
        <p className="text-xs text-primary truncate">
          Install Azayon on your phone for one-tap access.{' '}
          <button onClick={triggerInstall} className="font-semibold underline underline-offset-2 hover:opacity-70 transition-opacity">
            Install now
          </button>
        </p>
      </div>
      <button onClick={dismiss} className="shrink-0 p-1 rounded hover:bg-primary/10 transition-colors">
        <X className="w-3.5 h-3.5 text-primary" />
      </button>
    </div>
  );
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
      className="flex items-center justify-between gap-4 px-4 py-2 shrink-0"
      style={{ backgroundColor: 'hsl(243 75% 97%)', borderBottom: '1px solid hsl(243 75% 88%)' }}
    >
      <p className="text-xs text-primary">
        📧 Please verify your email address.{' '}
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
  const { org } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Show onboarding wizard automatically for new orgs (admin only — sales reps
  // shouldn't be hit with setup tasks). Once completed or skipped, the org's
  // onboarding flag flips and the wizard stops appearing.
  const onboarding = org?.onboarding;
  const showOnboarding =
    !!org &&
    !onboarding?.completed &&
    !onboarding?.skipped;

  // Subscribe this session to realtime events from teammates
  useRealtimeSync();

  // Cmd+K (mac) / Ctrl+K (win) opens global search.
  // Also support "/" as a shortcut when not typing in an input.
  useEffect(() => {
    const onKey = (e) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      const isSlash =
        e.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) &&
        !document.activeElement?.isContentEditable;
      if (isCmdK || isSlash) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openSidebar = () => {
    setSidebarOpen(true);
    document.body.classList.add('sidebar-open');
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    document.body.classList.remove('sidebar-open');
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-background)' }}>
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar title={title} onMenuClick={openSidebar} onSearchClick={() => setSearchOpen(true)} />
        <TrialBanner />
        <PlanStatusBanner />
        <VerifyEmailBanner />
        <InstallBanner />
        {isViewer && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 shrink-0">
            <span className="text-xs font-medium text-amber-700">
              👁 View-only access. Contact your admin to make changes.
            </span>
          </div>
        )}
        <main
          className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6"
          style={{ backgroundColor: 'hsl(220 20% 97%)' }}
        >
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <OnboardingWizard open={showOnboarding} onClose={() => { /* org refresh closes it */ }} />
    </div>
  );
}