import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import { useRole } from '@/hooks/useRole';
import { useAuth } from '@/context/AuthContext';
import { X } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { TrialBanner, PlanStatusBanner } from '@/components/PlanBanners';
import SearchModal from '@/components/SearchModal';

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
  return PAGE_TITLES[pathname] || 'Azayon';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

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
    </div>
  );
}