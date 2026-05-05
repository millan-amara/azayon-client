import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/context/SocketContext';
import { useAuth } from '@/context/AuthContext';

// Map of socket event name → query keys to invalidate on receipt.
// Each handler receives (queryClient, payload) so it can target by id.
const HANDLERS = {
  'contact.created':  (qc) => qc.invalidateQueries({ queryKey: ['contacts'] }),
  'contact.updated':  (qc, p) => {
    qc.invalidateQueries({ queryKey: ['contacts'] });
    if (p.contactId) qc.invalidateQueries({ queryKey: ['contact', p.contactId] });
  },
  'contact.archived': (qc) => qc.invalidateQueries({ queryKey: ['contacts'] }),
  'contacts.bulk_updated': (qc) => {
    qc.invalidateQueries({ queryKey: ['contacts'] });
    qc.invalidateQueries({ queryKey: ['contact-tags'] });
  },
  'contacts.imported': (qc) => qc.invalidateQueries({ queryKey: ['contacts'] }),

  'deal.created': (qc) => {
    qc.invalidateQueries({ queryKey: ['deals'] });
    qc.invalidateQueries({ queryKey: ['kanban'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  },
  'deal.updated': (qc, p) => {
    qc.invalidateQueries({ queryKey: ['deals'] });
    qc.invalidateQueries({ queryKey: ['kanban'] });
    if (p.dealId) qc.invalidateQueries({ queryKey: ['deal', p.dealId] });
  },
  'deal.won': (qc) => {
    qc.invalidateQueries({ queryKey: ['deals'] });
    qc.invalidateQueries({ queryKey: ['kanban'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  },
  'deal.lost': (qc) => {
    qc.invalidateQueries({ queryKey: ['deals'] });
    qc.invalidateQueries({ queryKey: ['kanban'] });
  },
  'deal.deleted': (qc) => {
    qc.invalidateQueries({ queryKey: ['deals'] });
    qc.invalidateQueries({ queryKey: ['kanban'] });
  },

  'task.created': (qc) => {
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  },
  'task.updated': (qc) => {
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  },
  'task.deleted': (qc) => qc.invalidateQueries({ queryKey: ['tasks'] }),

  'pipeline.created': (qc) => qc.invalidateQueries({ queryKey: ['pipelines'] }),
  'pipeline.updated': (qc) => {
    qc.invalidateQueries({ queryKey: ['pipelines'] });
    qc.invalidateQueries({ queryKey: ['kanban'] });
  },
  'pipeline.deleted': (qc) => qc.invalidateQueries({ queryKey: ['pipelines'] }),
};

// Subscribes the current session to org-wide realtime events and refreshes
// react-query caches when teammates make changes. Self-emitted events are
// skipped — the originating mutation's own onSuccess already invalidated.
export function useRealtimeSync() {
  const { socket } = useSocket() || {};
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!socket || !user) return;
    const myId = user._id;

    const subs = Object.entries(HANDLERS).map(([event, handler]) => {
      const fn = (payload = {}) => {
        if (payload.actor && payload.actor === myId) return;
        handler(qc, payload);
      };
      socket.on(event, fn);
      return [event, fn];
    });

    return () => {
      subs.forEach(([event, fn]) => socket.off(event, fn));
    };
  }, [socket, user, qc]);
}
