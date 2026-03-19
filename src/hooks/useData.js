import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';

// Shared query defaults — reduces unnecessary refetches over slow connections
const STALE_1MIN = { staleTime: 60_000, refetchOnWindowFocus: false };
const STALE_5MIN = { staleTime: 300_000, refetchOnWindowFocus: false };
const STALE_30MIN = { staleTime: 1_800_000, refetchOnWindowFocus: false };

// ─── CONTACTS ────────────────────────────────────────────────────────────────

export function useContacts(params = {}) {
  return useQuery({
    queryKey: ['contacts', params],
    queryFn: () => api.get('/contacts', { params }).then((r) => r.data),
    ...STALE_1MIN,
  });
}

export function useContact(id) {
  return useQuery({
    queryKey: ['contact', id],
    queryFn: () => api.get(`/contacts/${id}`).then((r) => r.data),
    enabled: !!id,
    ...STALE_1MIN,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/contacts', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact created');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to create contact'),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/contacts/${id}`, data).then((r) => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['contact', id] });
      toast.success('Contact updated');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to update contact'),
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/contacts/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact archived');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to archive contact'),
  });
}

export function useAddTimeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.post(`/contacts/${id}/timeline`, data).then((r) => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['contact', id] });
    },
  });
}

export function useContactTags() {
  return useQuery({
    queryKey: ['contact-tags'],
    queryFn: () => api.get('/contacts/tags/all').then((r) => r.data),
    ...STALE_5MIN,
  });
}

// ─── DEALS ───────────────────────────────────────────────────────────────────

export function useDeals(params = {}) {
  return useQuery({
    queryKey: ['deals', params],
    queryFn: () => api.get('/deals', { params }).then((r) => r.data),
    ...STALE_1MIN,
  });
}

export function useKanban(pipelineId) {
  return useQuery({
    queryKey: ['kanban', pipelineId],
    queryFn: () => api.get(`/deals/kanban/${pipelineId}`).then((r) => r.data),
    enabled: !!pipelineId,
    ...STALE_1MIN,
  });
}

export function useDeal(id) {
  return useQuery({
    queryKey: ['deal', id],
    queryFn: () => api.get(`/deals/${id}`).then((r) => r.data),
    enabled: !!id,
    ...STALE_1MIN,
  });
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/deals', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['kanban'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Deal created');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to create deal'),
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/deals/${id}`, data).then((r) => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['kanban'] });
      qc.invalidateQueries({ queryKey: ['deal', id] });
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to update deal'),
  });
}

export function useMarkDealWon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.post(`/deals/${id}/won`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['kanban'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('🎉 Deal marked as won!');
    },
  });
}

export function useMarkDealLost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }) => api.post(`/deals/${id}/lost`, { reason }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['kanban'] });
      toast.success('Deal marked as lost');
    },
  });
}

export function useDeleteDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/deals/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['kanban'] });
      toast.success('Deal deleted');
    },
  });
}

// ─── PIPELINES ───────────────────────────────────────────────────────────────

export function usePipelines() {
  return useQuery({
    queryKey: ['pipelines'],
    queryFn: () => api.get('/pipelines').then((r) => r.data),
    ...STALE_30MIN, // pipelines rarely change
  });
}

// ─── TASKS ───────────────────────────────────────────────────────────────────

export function useTasks(params = {}) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: () => api.get('/tasks', { params }).then((r) => r.data),
    ...STALE_1MIN,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/tasks', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Task created');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to create task'),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => {
      if (!data.assignedTo) delete data.assignedTo;
      if (!data.contact) delete data.contact;
      if (!data.deal) delete data.deal;
      return api.put(`/tasks/${id}`, data).then((r) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to update task'),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/tasks/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task deleted');
    },
  });
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then((r) => r.data),
    staleTime: 300_000,       // 5 min — dashboard stats don't need to be live
    refetchOnWindowFocus: false,
  });
}

// ─── AUTOMATIONS ─────────────────────────────────────────────────────────────

export function useAutomations() {
  return useQuery({
    queryKey: ['automations'],
    queryFn: () => api.get('/automations').then((r) => r.data),
    ...STALE_5MIN,
  });
}

export function useAutomationTemplates() {
  return useQuery({
    queryKey: ['automation-templates'],
    queryFn: () => api.get('/automations/templates').then((r) => r.data),
    ...STALE_30MIN, // templates never change at runtime
  });
}

export function useCreateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/automations', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Automation created');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to create automation'),
  });
}

export function useToggleAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.patch(`/automations/${id}/toggle`).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['automations'] });
      toast.success(data.isActive ? 'Automation enabled' : 'Automation disabled');
    },
  });
}

export function useDeleteAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/automations/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Automation deleted');
    },
  });
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

export function useNotifications(params = {}) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => api.get('/notifications', { params }).then((r) => r.data),
    staleTime: 300_000,         // socket invalidates this in real time
    refetchOnWindowFocus: false,
    refetchInterval: false,     // no polling — socket handles updates
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.put('/notifications/read-all').then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

// ─── USERS ───────────────────────────────────────────────────────────────────

export function useTeam() {
  return useQuery({
    queryKey: ['team'],
    queryFn: () => api.get('/users').then((r) => r.data),
    ...STALE_5MIN,
  });
}

export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/users/invite', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] });
      qc.invalidateQueries({ queryKey: ['pending-invites'] });
      toast.success('Invite sent');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to send invite'),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/users/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] });
      toast.success('User updated');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to update user'),
  });
}

export function useRemoveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.patch(`/users/${id}/deactivate`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] });
      toast.success('User deactivated');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to deactivate user'),
  });
}

export function useReactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.patch(`/users/${id}/reactivate`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] });
      toast.success('User reactivated');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to reactivate user'),
  });
}

export function usePendingInvites() {
  return useQuery({
    queryKey: ['pending-invites'],
    queryFn: () => api.get('/users/invites/pending').then((r) => r.data),
    ...STALE_5MIN,
  });
}

export function useCancelInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/users/invites/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-invites'] });
      toast.success('Invite cancelled');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to cancel invite'),
  });
}