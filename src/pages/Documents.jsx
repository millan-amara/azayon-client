import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FileText, Search, Eye, Trash2, Download } from 'lucide-react';
import { useDocuments, useDeleteDocument } from '@/hooks/useData';
import { useRole } from '@/hooks/useRole';
import { Button, Card, EmptyState, Spinner, Modal } from '@/components/ui';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

const STATUS_COLORS = {
  draft:     'bg-gray-100 text-gray-700',
  sent:      'bg-blue-100 text-blue-700',
  viewed:    'bg-amber-100 text-amber-700',
  paid:      'bg-green-100 text-green-700',
  overdue:   'bg-red-100 text-red-700',
  accepted:  'bg-green-100 text-green-700',
  declined:  'bg-red-100 text-red-700',
  expired:   'bg-gray-100 text-gray-600',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function Documents() {
  const navigate = useNavigate();
  const { canWrite } = useRole();
  const [type, setType] = useState('invoice');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deletingDoc, setDeletingDoc] = useState(null);

  const { data, isLoading } = useDocuments({ type, status: status || undefined, search: search || undefined, page, limit: 25 });
  const { mutate: del } = useDeleteDocument();

  const documents = data?.documents || [];
  const pagination = data?.pagination;

  const tabs = [
    { id: 'invoice', label: 'Invoices' },
    { id: 'quote',   label: 'Quotes' },
  ];

  const statusOptions = type === 'invoice'
    ? ['', 'draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled']
    : ['', 'draft', 'sent', 'viewed', 'accepted', 'declined', 'expired'];

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Tabs */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1 p-0.5 rounded-lg border border-border bg-muted/30">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setType(t.id); setPage(1); setStatus(''); }}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                type === t.id ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => navigate(`/documents/new?type=${type}`)}>
            <Plus className="w-4 h-4" />
            New {type}
          </Button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder={`Search ${type}s by number or customer…`}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="h-9 px-3 rounded-lg border border-border bg-background text-sm focus-visible:outline-none"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s ? s[0].toUpperCase() + s.slice(1) : 'All statuses'}</option>
          ))}
        </select>
      </div>

      {/* List */}
      <Card>
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={`No ${type}s yet`}
            description={`Create your first ${type} to send to a customer.`}
            action={canWrite ? <Button onClick={() => navigate(`/documents/new?type=${type}`)}><Plus className="w-4 h-4" />New {type}</Button> : null}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Number</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                    {type === 'invoice' ? 'Due' : 'Valid until'}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Issued</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d._id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors group">
                    <td className="px-4 py-3">
                      <Link to={`/documents/${d._id}`} className="font-medium hover:text-primary transition-colors">
                        {d.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{d.customerName}</p>
                      {d.customerCompany && <p className="text-xs text-muted-foreground">{d.customerCompany}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', STATUS_COLORS[d.status])}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(d.total, d.currency)}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{formatDate(d.dueDate)}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{formatDate(d.issueDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Link to={`/documents/${d._id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        {canWrite && d.status === 'draft' && (
                          <button
                            onClick={() => setDeletingDoc(d)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-100 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete draft"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Page {page} of {pagination.pages} · {pagination.total} total
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      <Modal open={!!deletingDoc} onClose={() => setDeletingDoc(null)} title={`Delete ${deletingDoc?.type || 'document'} ${deletingDoc?.number || ''}?`}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This draft will be removed permanently. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeletingDoc(null)}>Cancel</Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
              onClick={() => { del(deletingDoc._id); setDeletingDoc(null); }}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
