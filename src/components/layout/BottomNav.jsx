import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, KanbanSquare, CheckSquare, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Home', exact: true },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/pipeline', icon: KanbanSquare, label: 'Pipeline' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 lg:hidden bg-card border-t border-border">
      <div className="flex items-center justify-around h-16 px-2">
        {NAV.map(({ to, icon: Icon, label, exact }) => {
          const active = exact ? location.pathname === to : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 py-2 rounded-lg transition-colors min-w-0',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className={cn('text-[10px] font-medium truncate', active ? 'text-primary' : 'text-muted-foreground')}>
                {label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}