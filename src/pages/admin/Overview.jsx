import { useQuery } from '@tanstack/react-query';
import { Building2, Users, Phone, KanbanSquare, FileText, Crown, TrendingUp, Activity } from 'lucide-react';
import api from '@/lib/api';
import { Card, StatCard, Spinner, Badge } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';

function useOverview() {
  return useQuery({
    queryKey: ['superadmin', 'overview'],
    queryFn: () => api.get('/superadmin/overview').then((r) => r.data),
    staleTime: 60_000,
  });
}

function useSignups(days = 30) {
  return useQuery({
    queryKey: ['superadmin', 'signups', days],
    queryFn: () => api.get('/superadmin/signups', { params: { days } }).then((r) => r.data),
    staleTime: 60_000,
  });
}

// Tiny inline sparkline so we don't need to pull recharts (Dashboard already does).
function Sparkline({ series, accessor, color = 'hsl(243 75% 59%)' }) {
  if (!series?.length) return null;
  const values = series.map(accessor);
  const max = Math.max(...values, 1);
  const width = 600;
  const height = 80;
  const step = width / Math.max(series.length - 1, 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * (height - 6) - 3).toFixed(1)}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
      {values.map((v, i) => (
        <circle
          key={i}
          cx={(i * step).toFixed(1)}
          cy={(height - (v / max) * (height - 6) - 3).toFixed(1)}
          r="1.5"
          fill={color}
        />
      ))}
    </svg>
  );
}

export default function Overview() {
  const { data, isLoading } = useOverview();
  const { data: signups } = useSignups(30);

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Spinner /></div>;
  }
  if (!data) return <p className="text-sm text-muted-foreground">Failed to load.</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Orgs"     value={data.totals.orgs}     sub={`+${data.growth.orgsLast30} in 30d`} icon={Building2}     color="primary" />
        <StatCard label="Users"    value={data.totals.users}    sub={`+${data.growth.usersLast30} in 30d`} icon={Users}        color="blue" />
        <StatCard label="Active orgs (7d)" value={data.growth.activeOrgsLast7} icon={Activity} color="green" />
        <StatCard label="Founding members" value={data.totals.foundingMembers} icon={Crown} color="amber" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Contacts"  value={data.totals.contacts.toLocaleString()}  icon={Phone}        color="primary" />
        <StatCard label="Deals"     value={data.totals.deals.toLocaleString()}     icon={KanbanSquare} color="blue" />
        <StatCard label="Documents" value={data.totals.documents.toLocaleString()} icon={FileText}     color="amber" />
        <StatCard
          label="Won this month"
          value={formatCurrency(data.revenue.wonValueThisMonth)}
          sub={`${data.revenue.wonDealsThisMonth} deals`}
          icon={TrendingUp}
          color="green"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Signups · last 30 days</p>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> orgs</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> users</span>
            </div>
          </div>
          {signups?.series?.length ? (
            <div className="space-y-1">
              <Sparkline series={signups.series} accessor={(d) => d.orgs} color="hsl(243 75% 59%)" />
              <Sparkline series={signups.series} accessor={(d) => d.users} color="hsl(217 91% 60%)" />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                <span>{formatDate(signups.series[0]?.date, 'd MMM')}</span>
                <span>{formatDate(signups.series.at(-1)?.date, 'd MMM')}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No data yet.</p>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold mb-3">Plan distribution</p>
          <div className="space-y-2">
            {Object.entries(data.planBreakdown).length === 0 && (
              <p className="text-xs text-muted-foreground">No orgs yet.</p>
            )}
            {Object.entries(data.planBreakdown).map(([plan, count]) => (
              <div key={plan} className="flex items-center justify-between text-sm">
                <span className="capitalize">{plan}</span>
                <Badge variant={plan === 'growth' ? 'success' : 'secondary'}>{count}</Badge>
              </div>
            ))}
          </div>

          <div className="border-t border-border mt-4 pt-4">
            <p className="text-sm font-semibold mb-3">Subscription status</p>
            <div className="space-y-2">
              {Object.entries(data.statusBreakdown).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{status.replace('_', ' ')}</span>
                  <Badge
                    variant={
                      status === 'active' ? 'success' :
                      status === 'past_due' || status === 'cancelled' ? 'danger' :
                      status === 'trialing' || status === 'cancelling' ? 'warning' :
                      'secondary'
                    }
                  >
                    {count}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
