import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { Button, Card, Badge, Select, Spinner, EmptyState } from '@/components/ui';
import { formatCurrency, timeAgo, DEAL_STATUS_COLORS } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

export default function Deals() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const params = { page, limit: 25, status: status || undefined };
  const { data, isLoading } = useQuery({
    queryKey: ['superadmin', 'deals', params],
    queryFn: () => api.get('/superadmin/deals', { params }).then((r) => r.data),
    staleTime: 30_000,
  });

  const total = data?.total || 0;
  const totalPages = Math.max(Math.ceil(total / 25), 1);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Select options={STATUS_OPTIONS} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} className="sm:w-44" />
      </div>

      <Card className="overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : data?.deals?.length === 0 ? (
          <EmptyState title="No deals match" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Deal</th>
                <th className="px-4 py-2 font-medium">Org</th>
                <th className="px-4 py-2 font-medium">Stage</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Value</th>
                <th className="px-4 py-2 font-medium">Owner</th>
                <th className="px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.deals.map((d) => (
                <tr key={d._id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-medium">{d.title}</p>
                    {d.contact && (
                      <p className="text-xs text-muted-foreground">
                        {[d.contact.firstName, d.contact.lastName].filter(Boolean).join(' ') || d.contact.company}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">{d.orgId?.name || '—'}</td>
                  <td className="px-4 py-3">{d.stageName || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${DEAL_STATUS_COLORS[d.status] || 'bg-gray-100 text-gray-700'}`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(d.value, d.currency)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{d.assignedTo?.name || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{timeAgo(d.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{total} deals · page {page} of {totalPages}</span>
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
