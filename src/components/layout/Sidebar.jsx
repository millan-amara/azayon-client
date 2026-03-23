import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, KanbanSquare, CheckSquare,
  Zap, Settings, X, Building2,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/pipeline', icon: KanbanSquare, label: 'Pipeline' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/automations', icon: Zap, label: 'Automations' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ open, onClose }) {
  const { user, org } = useAuth();
  const location = useLocation();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col w-56 transition-transform duration-200 lg:relative lg:translate-x-0 lg:z-auto shrink-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ backgroundColor: 'var(--color-sidebar)' }}
      >
        {/* Logo / Org */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-5 border-b shrink-0"
          style={{ borderColor: 'var(--color-sidebar-muted)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-sidebar-foreground)' }}>
                {org?.name || 'Azayon'}
              </p>
              <p className="text-xs truncate capitalize" style={{ color: 'hsl(220 15% 55%)' }}>
                {user?.role?.replace('_', ' ')}
              </p>
            </div>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="w-4 h-4" style={{ color: 'var(--color-sidebar-foreground)' }} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label, exact }) => {
            const active = exact ? location.pathname === to : location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  active ? 'text-white' : 'hover:text-white'
                )}
                style={{
                  color: active ? 'white' : 'var(--color-sidebar-foreground)',
                  backgroundColor: active ? 'var(--color-primary)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.backgroundColor = 'var(--color-sidebar-muted)';
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-3 border-t shrink-0" style={{ borderColor: 'var(--color-sidebar-muted)' }}>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
              style={{ backgroundColor: 'var(--color-sidebar-muted)', color: 'var(--color-sidebar-foreground)' }}
            >
              {getInitials(user?.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--color-sidebar-foreground)' }}>
                {user?.name}
              </p>
              <p className="text-xs truncate" style={{ color: 'hsl(220 15% 50%)' }}>
                {user?.email}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}