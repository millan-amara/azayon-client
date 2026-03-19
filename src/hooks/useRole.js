import { useAuth } from '@/context/AuthContext';

export function useRole() {
  const { user } = useAuth();
  const role = user?.role;

  return {
    role,
    isAdmin: role === 'admin',
    isSalesRep: role === 'sales_rep',
    isViewer: role === 'viewer',
    canWrite: role === 'admin' || role === 'sales_rep',
  };
}