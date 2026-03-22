// import { useState, useEffect } from 'react';
// import { Bell, LogOut, User, ChevronDown } from 'lucide-react';
// import { useNavigate } from 'react-router-dom';
// import { useAuth } from '@/context/AuthContext';
// import { useSocket } from '@/context/SocketContext';
// import { useNotifications, useMarkAllRead } from '@/hooks/useData';
// import { timeAgo, getInitials, cn } from '@/lib/utils';
// import { useQueryClient } from '@tanstack/react-query';

// function NotificationBell() {
//   const [open, setOpen] = useState(false);
//   const { socket } = useSocket();
//   const { user } = useAuth();
//   const qc = useQueryClient();
//   const { data } = useNotifications({ limit: 8 });
//   const { mutate: markAllRead } = useMarkAllRead();

//   const unread = data?.unreadCount || 0;

//   // Listen for real-time notifications
//   useEffect(() => {
//     if (!socket || !user) return;
//     const handler = (payload) => {
//       if (payload.userId === user._id) {
//         qc.invalidateQueries({ queryKey: ['notifications'] });
//       }
//     };
//     socket.on('notification', handler);
//     return () => socket.off('notification', handler);
//   }, [socket, user, qc]);

//   return (
//     <div className="relative">
//       <button
//         onClick={() => setOpen((o) => !o)}
//         className="relative p-2 rounded-lg hover:bg-muted transition-colors"
//       >
//         <Bell className="w-4 h-4" />
//         {unread > 0 && (
//           <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
//             {unread > 9 ? '9+' : unread}
//           </span>
//         )}
//       </button>

//       {open && (
//         <>
//           <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
//           <div className="absolute right-0 top-10 w-80 bg-background border border-border rounded-xl shadow-lg z-20 overflow-hidden">
//             <div className="flex items-center justify-between px-4 py-3 border-b border-border">
//               <span className="text-sm font-semibold">Notifications</span>
//               {unread > 0 && (
//                 <button
//                   onClick={() => markAllRead()}
//                   className="text-xs text-primary hover:underline"
//                 >
//                   Mark all read
//                 </button>
//               )}
//             </div>
//             <div className="max-h-80 overflow-y-auto">
//               {data?.notifications?.length === 0 ? (
//                 <p className="text-sm text-muted-foreground text-center py-8">No notifications</p>
//               ) : (
//                 data?.notifications?.map((n) => (
//                   <div
//                     key={n._id}
//                     className={cn(
//                       'px-4 py-3 border-b border-border last:border-0',
//                       !n.isRead && 'bg-primary/5'
//                     )}
//                   >
//                     <p className="text-sm font-medium">{n.title}</p>
//                     {n.message && <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>}
//                     <p className="text-xs text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
//                   </div>
//                 ))
//               )}
//             </div>
//           </div>
//         </>
//       )}
//     </div>
//   );
// }

// export default function Navbar({ title }) {
//   const { user, logout } = useAuth();
//   const navigate = useNavigate();
//   const [userOpen, setUserOpen] = useState(false);

//   return (
//     <header className="h-14 border-b border-border bg-background flex items-center justify-between px-6 shrink-0">
//       <h1 className="text-base font-semibold">{title}</h1>

//       <div className="flex items-center gap-2">
//         <NotificationBell />

//         <div className="relative">
//           <button
//             onClick={() => setUserOpen((o) => !o)}
//             className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted transition-colors text-sm"
//           >
//             <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
//               {getInitials(user?.name)}
//             </div>
//             <span className="hidden sm:block font-medium">{user?.name}</span>
//             <ChevronDown className="w-3 h-3 text-muted-foreground" />
//           </button>

//           {userOpen && (
//             <>
//               <div className="fixed inset-0 z-10" onClick={() => setUserOpen(false)} />
//               <div className="absolute right-0 top-10 w-44 bg-background border border-border rounded-xl shadow-lg z-20 overflow-hidden py-1">
//                 <button
//                   onClick={() => { navigate('/settings'); setUserOpen(false); }}
//                   className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors"
//                 >
//                   <User className="w-3.5 h-3.5" /> Profile
//                 </button>
//                 <div className="my-1 border-t border-border" />
//                 <button
//                   onClick={logout}
//                   className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
//                 >
//                   <LogOut className="w-3.5 h-3.5" /> Sign out
//                 </button>
//               </div>
//             </>
//           )}
//         </div>
//       </div>
//     </header>
//   );
// }


import { useState, useEffect } from 'react';
import { Bell, LogOut, User, ChevronDown, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { useNotifications, useMarkAllRead } from '@/hooks/useData';
import { timeAgo, getInitials, cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { socket } = useSocket();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data } = useNotifications({ limit: 8 });
  const { mutate: markAllRead } = useMarkAllRead();

  const unread = data?.unreadCount || 0;

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

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg hover:bg-muted transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 w-80 bg-background border border-border rounded-xl shadow-lg z-20 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold">Notifications</span>
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
              {data?.notifications?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No notifications</p>
              ) : (
                data?.notifications?.map((n) => (
                  <div
                    key={n._id}
                    className={cn(
                      'px-4 py-3 border-b border-border last:border-0',
                      !n.isRead && 'bg-primary/5'
                    )}
                  >
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.message && <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Navbar({ title, onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [userOpen, setUserOpen] = useState(false);

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