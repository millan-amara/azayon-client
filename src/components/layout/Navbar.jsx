import { useState, useEffect } from 'react';
import {
  Bell, LogOut, User, ChevronDown, Menu, Search,
  CheckSquare, Trophy, XCircle, UserPlus, Zap, AtSign, MoveRight, BellOff,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { useNotifications, useMarkAllRead, useMarkNotificationRead } from '@/hooks/useData';
import { timeAgo, getInitials, cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

// Type → { icon, color class }
const NOTIF_ICONS = {
  task_due:             { Icon: CheckSquare,  className: 'text-amber-600 bg-amber-50' },
  task_assigned:        { Icon: CheckSquare,  className: 'text-blue-600 bg-blue-50' },
  deal_assigned:        { Icon: MoveRight,    className: 'text-blue-600 bg-blue-50' },
  deal_won:             { Icon: Trophy,       className: 'text-green-600 bg-green-50' },
  deal_lost:            { Icon: XCircle,      className: 'text-red-500 bg-red-50' },
  deal_stage_changed:   { Icon: MoveRight,    className: 'text-primary bg-primary/10' },
  new_contact:          { Icon: UserPlus,     className: 'text-teal-600 bg-teal-50' },
  automation_triggered: { Icon: Zap,          className: 'text-purple-600 bg-purple-50' },
  team_invite:          { Icon: UserPlus,     className: 'text-primary bg-primary/10' },
  mention:              { Icon: AtSign,       className: 'text-primary bg-primary/10' },
};

function notificationLink(notif) {
  if (!notif.resourceId) return null;
  switch (notif.resourceType) {
    case 'deal':    return `/deals/${notif.resourceId}`;
    case 'contact': return `/contacts/${notif.resourceId}`;
    case 'task':    return '/tasks';
    case 'automation': return '/automations';
    case 'user':    return '/settings';
    default: return null;
  }
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { socket } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useNotifications({ limit: 8 });
  const { mutate: markAllRead } = useMarkAllRead();
  const { mutate: markRead } = useMarkNotificationRead();

  const unread = data?.unreadCount || 0;
  const notifications = data?.notifications || [];

  // Listen for real-time notifications
  useEffect(() => {
    if (!socket || !user) return;
    const handler = (payload) => {
      if (payload.userId === user._id) {
        qc.invalidateQueries({ queryKey: ['notifications'] });
      }
    };
    socket.on('notification', handler);
    return () => socket.off('notification', handler);
  }, [socket, user, qc]);

  const handleClick = (n) => {
    if (!n.isRead) markRead(n._id);
    const link = notificationLink(n);
    if (link) navigate(link);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg hover:bg-muted transition-colors"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          {/*
            Mobile: span the viewport with 0.5rem margins so we never run off
            the left edge (the bell is ~80px from the right because the user
            avatar sits to its right, so an `absolute right-0 w-80` anchored
            to the bell goes ~25px off-screen on a 375px-wide phone).
            sm and up: revert to the original bell-anchored 320px panel.
          */}
          <div className="fixed inset-x-2 top-14 sm:absolute sm:inset-x-auto sm:right-0 sm:top-10 sm:w-80 bg-background border border-border rounded-xl shadow-lg z-20 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Notifications</span>
                {unread > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">
                    {unread}
                  </span>
                )}
              </div>
              {unread > 0 && (
                <button
                  onClick={() => markAllRead()}
                  className="text-xs text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <BellOff className="w-6 h-6 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">You're all caught up</p>
                  <p className="text-xs text-muted-foreground mt-0.5">New activity will show here</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const { Icon, className } = NOTIF_ICONS[n.type] || { Icon: Bell, className: 'text-muted-foreground bg-muted' };
                  const link = notificationLink(n);
                  return (
                    <button
                      key={n._id}
                      onClick={() => handleClick(n)}
                      className={cn(
                        'w-full flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 text-left transition-colors',
                        !n.isRead && 'bg-primary/5',
                        link ? 'hover:bg-muted cursor-pointer' : 'cursor-default'
                      )}
                    >
                      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0', className)}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm', !n.isRead ? 'font-semibold' : 'font-medium')}>{n.title}</p>
                        {n.message && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" aria-label="unread" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Navbar({ title, onMenuClick, onSearchClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [userOpen, setUserOpen] = useState(false);
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-4 h-4" />
        </button>
        <h1 className="text-sm font-semibold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Global search — keyboard shortcut handled in Layout */}
        {onSearchClick && (
          <button
            onClick={onSearchClick}
            className="hidden sm:flex items-center gap-2 h-8 pl-2.5 pr-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            aria-label="Search"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="text-xs">Search…</span>
            <kbd className="text-[10px] font-semibold bg-muted text-muted-foreground rounded border border-border px-1 py-0.5">
              {isMac ? '⌘' : 'Ctrl'} K
            </kbd>
          </button>
        )}
        {onSearchClick && (
          <button
            onClick={onSearchClick}
            className="sm:hidden p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Search"
          >
            <Search className="w-4 h-4" />
          </button>
        )}

        <NotificationBell />

        <div className="relative">
          <button
            onClick={() => setUserOpen((o) => !o)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted transition-colors text-sm"
          >
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
              {getInitials(user?.name)}
            </div>
            <span className="hidden sm:block font-medium">{user?.name}</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>

          {userOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setUserOpen(false)} />
              <div className="absolute right-0 top-10 w-44 bg-background border border-border rounded-xl shadow-lg z-20 overflow-hidden py-1">
                <button
                  onClick={() => { navigate('/settings'); setUserOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors"
                >
                  <User className="w-3.5 h-3.5" /> Profile
                </button>
                <div className="my-1 border-t border-border" />
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}