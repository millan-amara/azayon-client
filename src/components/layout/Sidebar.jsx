import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, KanbanSquare, CheckSquare,
  Zap, Settings, ChevronLeft, ChevronRight, Building2,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/pipeline', icon: KanbanSquare, label: 'Pipeline' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/automations', icon: Zap, label: 'Automations' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { user, org } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'relative flex flex-col transition-all duration-200 shrink-0',
        collapsed ? 'w-16' : 'w-56'
      )}
      style={{ backgroundColor: 'var(--color-sidebar)' }}
    >
      {/* Logo / Org */}
      <div
        className={cn('flex items-center gap-3 px-4 py-5 border-b', collapsed && 'justify-center px-2')}
        style={{ borderColor: 'var(--color-sidebar-muted)' }}
      >
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-sidebar-foreground)' }}>
              {org?.name || 'My CRM'}
            </p>
            <p className="text-xs truncate capitalize" style={{ color: 'hsl(220 15% 55%)' }}>
              {user?.role?.replace('_', ' ')}
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label, exact }) => {
          const active = exact ? location.pathname === to : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                collapsed && 'justify-center px-2',
                active
                  ? 'text-white'
                  : 'hover:text-white'
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
              {!collapsed && <span>{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User */}
      {!collapsed && (
        <div className="px-3 py-3 border-t" style={{ borderColor: 'var(--color-sidebar-muted)' }}>
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
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full border bg-white flex items-center justify-center shadow-sm hover:bg-secondary transition-colors z-10"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {collapsed
          ? <ChevronRight className="w-3 h-3" style={{ color: 'var(--color-muted-foreground)' }} />
          : <ChevronLeft className="w-3 h-3" style={{ color: 'var(--color-muted-foreground)' }} />
        }
      </button>
    </aside>
  );
}