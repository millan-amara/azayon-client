import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Edit3, Trash2, Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { Button, Input, Card, Badge, Modal, Select, Spinner, EmptyState, Avatar } from '@/components/ui';
import { timeAgo } from '@/lib/utils';
import toast from 'react-hot-toast';

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'sales_rep', label: 'Sales rep' },
  { value: 'viewer', label: 'Viewer' },
];

export default function Users() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [editId, setEditId] = useState(null);

  const params = { page, limit: 25, search: search || undefined, role: role || undefined };
  const { data, isLoading } = useQuery({
    queryKey: ['superadmin', 'users', params],
    queryFn: () => api.get('/superadmin/users', { params }).then((r) => r.data),
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
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            className="pl-9"
          />
        </div>
        <Select options={ROLE_OPTIONS} value={role} onChange={(e) => { setPage(1); setRole(e.target.value); }} className="sm:w-44" />
      </div>

      <Card className="overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : data?.users?.length === 0 ? (
          <EmptyState title="No users match" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">Org</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Last login</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u._id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={u.name} size="sm" />
                      <div>
                        <p className="font-medium flex items-center gap-1">
                          {u.name}
                          {u.isSuperadmin && (
                            <span title="Superadmin"><Shield className="w-3 h-3 text-amber-600" /></span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p>{u.orgId?.name || '—'}</p>
                    <p className="text-xs text-muted-foreground capitalize">{u.orgId?.subscription?.plan}</p>
                  </td>
                  <td className="px-4 py-3 capitalize">{u.role.replace('_', ' ')}</td>
                  <td className="px-4 py-3">
                    {u.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                    {!u.emailVerified && <Badge variant="warning" className="ml-1">Unverified</Badge>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {u.lastLogin ? timeAgo(u.lastLogin) : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" onClick={() => setEditId(u._id)} aria-label="Edit">
                      <Edit3 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{total} users · page {page} of {totalPages}</span>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {editId && (
        <EditUserModal
          user={data.users.find((u) => u._id === editId)}
          onClose={() => setEditId(null)}
        />
      )}
    </div>
  );
}

function EditUserModal({ user, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    isSuperadmin: !!user.isSuperadmin,
    emailVerified: !!user.emailVerified,
  });

  const update = useMutation({
    mutationFn: (payload) => api.patch(`/superadmin/users/${user._id}`, payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin', 'users'] });
      toast.success('User updated');
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to update'),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/superadmin/users/${user._id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin', 'users'] });
      toast.success('User deleted');
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to delete'),
  });

  return (
    <Modal open onClose={onClose} title={`Edit · ${user.name}`}>
      <div className="space-y-4">
        <div className="text-xs text-muted-foreground">{user.email} · {user.orgId?.name}</div>
        <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Select
          label="Role (within their org)"
          options={ROLE_OPTIONS.filter((o) => o.value)}
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        />

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Active (uncheck to disable login)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.emailVerified} onChange={(e) => setForm({ ...form, emailVerified: e.target.checked })} />
            Email verified
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isSuperadmin} onChange={(e) => setForm({ ...form, isSuperadmin: e.target.checked })} />
            <span className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-amber-600" />
              Platform superadmin
            </span>
          </label>
        </div>

        <div className="flex justify-between pt-2">
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm(`Delete user ${user.name}? This cannot be undone.`)) remove.mutate();
            }}
            loading={remove.isPending}
          >
            <Trash2 className="w-4 h-4" /> Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => update.mutate(form)} loading={update.isPending}>Save</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
