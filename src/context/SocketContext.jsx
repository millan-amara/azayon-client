import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

// VITE_SOCKET_URL should be set to https://api.azayon.com (no /api, no trailing slash)
// Falls back to '/' for local dev where Vite proxy handles it
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '/';

export function SocketProvider({ children }) {
  const { user, org } = useAuth();
  // Hold the socket in state (not a ref) so consumers re-render once it connects.
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user || !org) return;

    const s = io(SOCKET_URL, { withCredentials: true });

    s.on('connect', () => {
      setConnected(true);
      s.emit('join_org', org._id);
    });

    s.on('disconnect', () => setConnected(false));

    // Publishing the socket instance to consumers is exactly the
    // "synchronize React with an external system" use case for effects.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [user, org]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSocket() {
  return useContext(SocketContext);
}