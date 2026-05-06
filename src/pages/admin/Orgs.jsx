import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Trash2, Edit3, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import api from '@/lib/api';
import { Button, Input, Card, Badge, Modal, Select, Spinner, EmptyState } from '@/components/ui';
import { formatDate, timeAgo, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const PLAN_OPTIONS = [
  { value: '', label: 'All plans' },
  { value: 'free', label: 'Free' },
  { value: 'growth', label: 'Growth' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'active', label: 'Active' },
  { value: 'cancelling', label: 'Cancelling' },
  { value: 'past_due', label: 'Past due' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'free', label: 'Free' },
];

function statusBadge(status) {
  const map = {
    active:     'success',
    trialing:   'warning',
    cancelling: 'warning',
    past_due:   'danger',
    cancelled:  'danger',
    free:       'secondary',
  };
  return <Badge variant={map[status] || 'secondary'}>{status}</Badge>;
}

export default function Orgs() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState('');
  const [status, setStatus] = useState('');
  const [editId, setEditId] = useState(null);
  const [viewId, setViewId] = useState(null);

  const params = { page, limit: 25, search: search || undefined, plan: plan || undefined, status: status || undefined };
  const { data, isLoading } = useQuery({
    queryKey: ['superadmin', 'orgs', params],
    queryFn: () => api.get('/superadmin/orgs', { params }).then((r) => r.data),
    staleTime: 30_000,
  });

  const total = data?.total || 0;
  const totalPages = Math.max(Math.ceil(total / 25), 1);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by org name or slug…"
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            className="pl-9"
          />
        </div>
        <Select options={PLAN_OPTIONS} value={plan} onChange={(e) => { setPage(1); setPlan(e.target.value); }} className="sm:w-40" />
        <Select options={STATUS_OPTIONS} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} className="sm:w-44" />
      </div>

      <Card className="overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : data?.orgs?.length === 0 ? (
          <EmptyState title="No orgs match" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Org</th>
                <th className="px-4 py-2 font-medium">Plan</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Users</th>
                <th className="px-4 py-2 font-medium text-right">Contacts</th>
                <th className="px-4 py-2 font-medium text-right">Deals</th>
                <th className="px-4 py-2 font-medium">Created</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.orgs.map((o) => (
                <tr key={o._id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-medium">{o.name}</p>
                    <p className="text-xs text-muted-foreground">{o.slug}</p>
                  </td>
                  <td className="px-4 py-3 capitalize">{o.subscription?.plan}</td>
                  <td className="px-4 py-3">{statusBadge(o.subscription?.status)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{o.counts.users}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{o.counts.contacts}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{o.counts.deals}</td>
                  <td className="px-4 py-3 text-muted-foreground">{timeAgo(o.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewId(o._id)} aria-label="View">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditId(o._id)} aria-label="Edit">
                        <Edit3 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{total} orgs · page {page} of {totalPages}</span>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {editId && <EditOrgModal orgId={editId} onClose={() => setEditId(null)} />}
      {viewId && <ViewOrgModal orgId={viewId} onClose={() => setViewId(null)} onEdit={() => { setEditId(viewId); setViewId(null); }} />}
    </div>
  );
}

function EditOrgModal({ orgId, onClose }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['superadmin', 'org', orgId],
    queryFn: () => api.get(`/superadmin/orgs/${orgId}`).then((r) => r.data),
  });

  const [form, setForm] = useState(null);
  if (data && form === null) {
    const o = data.org;
    setForm({
      name: o.name,
      plan: o.subscription?.plan || 'free',
      status: o.subscription?.status || 'trialing',
      trialEndsAt: o.subscription?.trialEndsAt ? new Date(o.subscription.trialEndsAt).toISOString().slice(0, 10) : '',
      isFoundingMember: !!o.subscription?.isFoundingMember,
    });
  }

  const update = useMutation({
    mutationFn: (payload) => api.patch(`/superadmin/orgs/${orgId}`, payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin'] });
      toast.success('Org updated');
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to update'),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/superadmin/orgs/${orgId}`, { params: { confirm: 'DELETE' } }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin'] });
      toast.success('Org deleted');
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to delete'),
  });

  return (
    <Modal open onClose={onClose} title={data?.org?.name ? `Edit · ${data.org.name}` : 'Edit org'}>
      {isLoading || !form ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Plan"
              options={[{ value: 'free', label: 'Free' }, { value: 'growth', label: 'Growth' }]}
              value={form.plan}
              onChange={(e) => setForm({ ...form, plan: e.target.value })}
            />
            <Select
              label="Status"
              options={STATUS_OPTIONS.filter((o) => o.value)}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            />
          </div>
          <Input
            label="Trial ends at"
            type="date"
            value={form.trialEndsAt}
            onChange={(e) => setForm({ ...form, trialEndsAt: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isFoundingMember}
              onChange={(e) => setForm({ ...form, isFoundingMember: e.target.checked })}
            />
            Founding member
          </label>

          <div className="flex justify-between pt-2">
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm(`Delete "${data.org.name}" and ALL its data? This cannot be undone.`)) {
                  remove.mutate();
                }
              }}
              loading={remove.isPending}
            >
              <Trash2 className="w-4 h-4" /> Delete org
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                onClick={() => update.mutate({
                  name: form.name,
                  subscription: {
                    plan: form.plan,
                    status: form.status,
                    trialEndsAt: form.trialEndsAt || null,
                    isFoundingMember: form.isFoundingMember,
                  },
                })}
                loading={update.isPending}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ViewOrgModal({ orgId, onClose, onEdit }) {
  const { data, isLoading } = useQuery({
    queryKey: ['superadmin', 'org', orgId],
    queryFn: () => api.get(`/superadmin/orgs/${orgId}`).then((r) => r.data),
  });

  return (
    <Modal open onClose={onClose} title="Org details" className="max-w-2xl">
      {isLoading || !data ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-base font-semibold">{data.org.name}</p>
            <p className="text-xs text-muted-foreground">{data.org.slug} · created {formatDate(data.org.createdAt)}</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {Object.entries(data.counts).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground capitalize">{k}</p>
                <p className="text-lg font-semibold tabular-nums">{v}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Subscription</p>
            <div className="rounded-lg border border-border p-3 space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span className="capitalize">{data.org.subscription?.plan}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span>{statusBadge(data.org.subscription?.status)}</div>
              {data.org.subscription?.trialEndsAt && (
                <div className="flex justify-between"><span className="text-muted-foreground">Trial ends</span><span>{formatDate(data.org.subscription.trialEndsAt)}</span></div>
              )}
              {data.org.subscription?.isFoundingMember && (
                <div className="flex justify-between"><span className="text-muted-foreground">Founding price</span><span>KES {data.org.subscription.foundingMemberPrice || '—'}</span></div>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Team ({data.users.length})</p>
            <div className="rounded-lg border border-border divide-y divide-border max-h-48 overflow-y-auto">
              {data.users.map((u) => (
                <div key={u._id} className="px-3 py-2 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('capitalize', !u.isActive && 'text-muted-foreground line-through')}>{u.role.replace('_', ' ')}</span>
                    {u.lastLogin && <span className="text-muted-foreground">{timeAgo(u.lastLogin)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={onEdit}><Edit3 className="w-4 h-4" /> Edit</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
