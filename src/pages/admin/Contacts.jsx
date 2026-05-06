import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { Button, Input, Card, Spinner, EmptyState } from '@/components/ui';
import { timeAgo } from '@/lib/utils';

export default function Contacts() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const params = { page, limit: 25, search: search || undefined };
  const { data, isLoading } = useQuery({
    queryKey: ['superadmin', 'contacts', params],
    queryFn: () => api.get('/superadmin/contacts', { params }).then((r) => r.data),
    staleTime: 30_000,
  });

  const total = data?.total || 0;
  const totalPages = Math.max(Math.ceil(total / 25), 1);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or company…"
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            className="pl-9"
          />
        </div>
      </div>

      <Card className="overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : data?.contacts?.length === 0 ? (
          <EmptyState title="No contacts match" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Phone</th>
                <th className="px-4 py-2 font-medium">Company</th>
                <th className="px-4 py-2 font-medium">Org</th>
                <th className="px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.contacts.map((c) => (
                <tr key={c._id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{[c.firstName, c.lastName].filter(Boolean).join(' ')}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.phone || '—'}</td>
                  <td className="px-4 py-3">{c.company || '—'}</td>
                  <td className="px-4 py-3">{c.orgId?.name || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{timeAgo(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{total} contacts · page {page} of {totalPages}</span>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
