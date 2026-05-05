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

export function useBulkUpdateContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, action, payload }) =>
      api.post('/contacts/bulk', { ids, action, payload }).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['contact-tags'] });
      toast.success(data.message || 'Contacts updated');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Bulk update failed'),
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

export function useKanban(pipelineId, assignedTo = '') {
  return useQuery({
    queryKey: ['kanban', pipelineId, assignedTo],
    queryFn: () => api.get(`/deals/kanban/${pipelineId}`, {
      params: assignedTo ? { assignedTo } : {},
    }).then((r) => r.data),
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
      qc.invalidateQueries({ queryKey: ['deal', id] });
      // Intentionally NOT invalidating ['kanban'] here — Pipeline.jsx manages
      // kanban cache manually via setQueryData for smooth drag-and-drop.
      // Invalidating would cause a refetch that overwrites the optimistic update.
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

export function useTasks(params = {}, options = {}) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: () => api.get('/tasks', { params }).then((r) => r.data),
    ...STALE_1MIN,
    ...options,
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

export function useCreatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/pipelines', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipelines'] });
      toast.success('Pipeline created');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to create pipeline'),
  });
}

export function useUpdatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/pipelines/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipelines'] });
      qc.invalidateQueries({ queryKey: ['kanban'] });
      toast.success('Pipeline saved');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to save pipeline'),
  });
}

export function useDeletePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/pipelines/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipelines'] });
      toast.success('Pipeline deleted');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to delete pipeline'),
  });
}

// ─── SAVED VIEWS (per-user filter combos) ────────────────────────────────────

export function useSavedViews(page) {
  return useQuery({
    queryKey: ['saved-views', page],
    queryFn: () => api.get('/saved-views', { params: { page } }).then((r) => r.data),
    enabled: !!page,
    ...STALE_5MIN,
  });
}

export function useCreateSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/saved-views', data).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['saved-views', data?.view?.page] });
      toast.success('View saved');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to save view'),
  });
}

export function useDeleteSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/saved-views/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-views'] });
      toast.success('View deleted');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to delete view'),
  });
}

// ─── CUSTOMERS ───────────────────────────────────────────────────────────────

export function useCustomers(params = {}) {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: () => api.get('/customers', { params }).then((r) => r.data),
    ...STALE_5MIN,
  });
}

// ─── REPORTS ─────────────────────────────────────────────────────────────────

export function useReports({ from, to } = {}) {
  return useQuery({
    queryKey: ['reports', from, to],
    queryFn: () => api.get('/reports', { params: { from, to } }).then((r) => r.data),
    ...STALE_5MIN,
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

export function useDashboardActivity(limit = 20) {
  return useQuery({
    queryKey: ['dashboard-activity', limit],
    queryFn: () => api.get('/dashboard/activity', { params: { limit } }).then((r) => r.data),
    ...STALE_1MIN,
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

export function useUpdateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/automations/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Automation updated');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to update automation'),
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

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.put(`/notifications/${id}/read`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

// ─── CUSTOM FIELDS ───────────────────────────────────────────────────────────

export function useCustomFields(entity) {
  return useQuery({
    queryKey: ['custom-fields', entity || 'all'],
    queryFn: () => api.get('/custom-fields', { params: entity ? { entity } : {} }).then((r) => r.data),
    ...STALE_5MIN,
  });
}

export function useCreateCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/custom-fields', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields'] });
      toast.success('Field added');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to add field'),
  });
}

export function useUpdateCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/custom-fields/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields'] });
      toast.success('Field updated');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to update field'),
  });
}

export function useDeleteCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/custom-fields/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields'] });
      toast.success('Field removed');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to remove field'),
  });
}

// ─── EMAIL TEMPLATES ─────────────────────────────────────────────────────────

export function useEmailTemplates(category) {
  return useQuery({
    queryKey: ['email-templates', category || 'all'],
    queryFn: () => api.get('/email-templates', { params: category ? { category } : {} }).then((r) => r.data),
    ...STALE_5MIN,
  });
}

export function useCreateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/email-templates', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Template saved');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to save template'),
  });
}

export function useUpdateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/email-templates/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Template updated');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to update'),
  });
}

export function useDeleteEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/email-templates/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Template deleted');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to delete'),
  });
}

// ─── DOCUMENTS (quotes & invoices) ───────────────────────────────────────────

export function useDocuments(params = {}) {
  return useQuery({
    queryKey: ['documents', params],
    queryFn: () => api.get('/documents', { params }).then((r) => r.data),
    ...STALE_1MIN,
  });
}

export function useDocument(id) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: () => api.get(`/documents/${id}`).then((r) => r.data),
    enabled: !!id,
    ...STALE_1MIN,
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/documents', data).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      toast.success(`${data?.document?.type === 'quote' ? 'Quote' : 'Invoice'} ${data?.document?.number} created`);
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to create document'),
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/documents/${id}`, data).then((r) => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['document', id] });
      toast.success('Saved');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to save'),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/documents/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Deleted');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to delete'),
  });
}

export function useSendDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.post(`/documents/${id}/send`, data).then((r) => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['document', id] });
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to send'),
  });
}

export function useMarkDocumentPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.post(`/documents/${id}/paid`, data).then((r) => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['document', id] });
      toast.success('Marked as paid');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to mark paid'),
  });
}

export function useAcceptQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.post(`/documents/${id}/accept`).then((r) => r.data),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['document', id] });
      toast.success('Quote accepted');
    },
  });
}

export function useDeclineQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }) => api.post(`/documents/${id}/decline`, { reason }).then((r) => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['document', id] });
      toast.success('Quote declined');
    },
  });
}

// ─── GLOBAL SEARCH ───────────────────────────────────────────────────────────

export function useGlobalSearch(q) {
  return useQuery({
    queryKey: ['search', q],
    queryFn: () => api.get('/search', { params: { q } }).then((r) => r.data),
    enabled: typeof q === 'string' && q.trim().length >= 2,
    staleTime: 30_000,
    keepPreviousData: true,
  });
}

// ─── ORG ─────────────────────────────────────────────────────────────────────

export function useUpdateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.put('/orgs/me', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org'] });
      toast.success('Organisation settings saved');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to update organisation'),
  });
}

export function useUpdateOnboarding() {
  return useMutation({
    mutationFn: (data) => api.put('/orgs/me/onboarding', data).then((r) => r.data),
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

export function usePendingInvites(isAdmin = true) {
  return useQuery({
    queryKey: ['pending-invites'],
    queryFn: () => api.get('/users/invites/pending').then((r) => r.data),
    enabled: isAdmin,
    ...STALE_5MIN,
    retry: false,
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