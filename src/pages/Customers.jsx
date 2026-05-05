import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Crown, Users, TrendingUp, Trophy, MessageCircle, Phone, Mail,
} from 'lucide-react';
import { useCustomers, useTeam } from '@/hooks/useData';
import { useAuth } from '@/context/AuthContext';
import { Card, EmptyState, Spinner } from '@/components/ui';
import { formatCurrency, formatDate, timeAgo, getWhatsAppUrl, cn } from '@/lib/utils';

const SORT_OPTIONS = [
  { value: 'lifetimeValue',  label: 'Lifetime value' },
  { value: 'lastWonAt',      label: 'Last purchase' },
  { value: 'lastContactedAt', label: 'Last contact' },
  { value: 'firstName',      label: 'Name (A→Z)' },
  { value: 'wonCount',       label: 'Number of deals' },
];

export default function Customers() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [sortBy, setSortBy] = useState('lifetimeValue');

  const { data, isLoading } = useCustomers({
    search: search || undefined,
    assignedTo: assignedTo || undefined,
    sortBy,
    sortOrder: sortBy === 'firstName' ? 'asc' : 'desc',
    limit: 200,
  });
  const { data: teamData } = useTeam();
  const teamMembers = (teamData?.users || []).filter((u) => u.isActive !== false);

  const customers = data?.customers || [];
  const summary = data?.summary || { count: 0, totalLifetimeValue: 0, totalWonDeals: 0 };

  // 60-day staleness cutoff — captured once per mount via useState lazy init
  const [staleCutoffMs] = useState(() => Date.now() - 60 * 24 * 60 * 60 * 1000);

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="w-4 h-4 text-primary" />
            <span>Active customers</span>
          </div>
          <p className="text-2xl font-bold mt-1">{summary.count}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span>Total lifetime value</span>
          </div>
          <p className="text-2xl font-bold mt-1">{formatCurrency(summary.totalLifetimeValue)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Trophy className="w-4 h-4 text-amber-600" />
            <span>Total won deals</span>
          </div>
          <p className="text-2xl font-bold mt-1">{summary.totalWonDeals}</p>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Search customers by name, company, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          className="h-9 px-3 rounded-lg border border-border bg-background text-sm focus-visible:outline-none"
        >
          <option value="">All customers</option>
          <option value={user?._id}>My customers</option>
          {teamMembers.filter((m) => m._id !== user?._id).map((m) => (
            <option key={m._id} value={m._id}>{m.name}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="h-9 px-3 rounded-lg border border-border bg-background text-sm focus-visible:outline-none"
        >
          {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>Sort: {s.label}</option>)}
        </select>
      </div>

      {/* List */}
      <Card>
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : customers.length === 0 ? (
          <EmptyState
            icon={Crown}
            title="No customers yet"
            description="Once you mark a deal as won, the contact moves into customers automatically. You can also set status to 'customer' on any contact."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Lifetime value</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Deals won</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Last purchase</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Last contact</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Owner</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email;
                  const waUrl = getWhatsAppUrl(c.phone);
                  const isStale = c.lastContactedAt && new Date(c.lastContactedAt).getTime() < staleCutoffMs;
                  return (
                    <tr key={c._id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors group">
                      <td className="px-4 py-3">
                        <Link to={`/contacts/${c._id}`} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                            {(c.firstName?.[0] || '') + (c.lastName?.[0] || '')}
                          </div>
                          <div>
                            <p className="font-medium hover:text-primary transition-colors">{fullName}</p>
                            {c.company && <p className="text-xs text-muted-foreground">{c.company}</p>}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatCurrency(c.lifetimeValue || 0)}
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                          {c.wonCount || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                        {c.lastWonAt ? formatDate(c.lastWonAt) : '—'}
                      </td>
                      <td className={cn(
                        'px-4 py-3 text-xs hidden lg:table-cell',
                        isStale ? 'text-amber-600 font-medium' : 'text-muted-foreground'
                      )}>
                        {c.lastContactedAt ? timeAgo(c.lastContactedAt) : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                        {c.assignedTo?.name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                              title="WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {c.phone && (
                            <a
                              href={`tel:${c.phone}`}
                              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                              title="Call"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {c.email && (
                            <a
                              href={`mailto:${c.email}`}
                              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                              title="Email"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
