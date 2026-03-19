import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

const PlanContext = createContext(null);

export function PlanProvider({ children }) {
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      // Use cached version if fresh (5 min) — avoids hitting DB on every page load
      const cached = sessionStorage.getItem('billingStatus');
      const cachedAt = sessionStorage.getItem('billingStatusAt');
      if (cached && cachedAt && Date.now() - parseInt(cachedAt) < 300_000) {
        setBilling(JSON.parse(cached));
        setLoading(false);
        return;
      }
      const { data } = await api.get('/billing/status');
      setBilling(data);
      sessionStorage.setItem('billingStatus', JSON.stringify(data));
      sessionStorage.setItem('billingStatusAt', Date.now().toString());
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const isGrowth = billing?.plan === 'growth' && billing?.status === 'active';
  const isTrialing = billing?.isOnTrial;
  const hasFullAccess = isGrowth || isTrialing;

  const canUse = (feature) => {
    if (!billing) return true; // optimistic while loading
    return hasFullAccess || (billing.limits?.features || []).includes(feature);
  };

  return (
    <PlanContext.Provider value={{
      billing,
      loading,
      isGrowth,
      isTrialing,
      hasFullAccess,
      canUse,
      refetch: () => {
        sessionStorage.removeItem('billingStatus');
        sessionStorage.removeItem('billingStatusAt');
        fetchStatus();
      },
    }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within PlanProvider');
  return ctx;
}