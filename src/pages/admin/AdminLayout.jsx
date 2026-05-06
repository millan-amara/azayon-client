import { NavLink, Outlet, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Users, KanbanSquare, Phone,
  CreditCard, Server, Shield,
} from 'lucide-react';
import { useRole } from '@/hooks/useRole';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/admin',           icon: LayoutDashboard, label: 'Overview',    end: true },
  { to: '/admin/orgs',      icon: Building2,       label: 'Orgs' },
  { to: '/admin/users',     icon: Users,           label: 'Users' },
  { to: '/admin/deals',     icon: KanbanSquare,    label: 'Deals' },
  { to: '/admin/contacts',  icon: Phone,           label: 'Contacts' },
  { to: '/admin/billing',   icon: CreditCard,      label: 'Billing' },
  { to: '/admin/system',    icon: Server,          label: 'System' },
];

export default function AdminLayout() {
  const { isSuperadmin } = useRole();
  if (!isSuperadmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
        <Shield className="w-3.5 h-3.5" />
        Superadmin area — actions here affect all tenants.
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-border -mx-4 px-4 lg:mx-0 lg:px-0">
        {NAV.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
