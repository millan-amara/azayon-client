import { useQuery } from '@tanstack/react-query';
import { Crown, TrendingDown, TrendingUp, Receipt } from 'lucide-react';
import api from '@/lib/api';
import { Card, StatCard, Spinner, Badge } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function Billing() {
  const { data, isLoading } = useQuery({
    queryKey: ['superadmin', 'billing'],
    queryFn: () => api.get('/superadmin/billing').then((r) => r.data),
    staleTime: 60_000,
  });

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!data) return <p className="text-sm text-muted-foreground">Failed to load.</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Paying orgs"     value={data.payingOrgs}                                 icon={Receipt}      color="green" />
        <StatCard label="Founding members" value={data.foundingMembers.count}                      icon={Crown}        color="amber" />
        <StatCard label="Founding revenue" value={formatCurrency(data.foundingMembers.sum)}        sub={`avg ${formatCurrency(Math.round(data.foundingMembers.avg || 0))}`} icon={TrendingUp} color="primary" />
        <StatCard label="Cancelled (30d)" value={data.cancelledLast30}                              icon={TrendingDown} color="red" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-sm font-semibold mb-3">By plan</p>
          {Object.entries(data.byPlan).map(([plan, count]) => (
            <div key={plan} className="flex items-center justify-between py-1 text-sm">
              <span className="capitalize">{plan}</span>
              <Badge variant={plan === 'growth' ? 'success' : 'secondary'}>{count}</Badge>
            </div>
          ))}
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold mb-3">By status</p>
          {Object.entries(data.byStatus).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between py-1 text-sm">
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
        </Card>
      </div>

      <Card className="p-5">
        <p className="text-sm font-semibold mb-3">Recently subscribed (30d)</p>
        {data.recentlySubscribed.length === 0 ? (
          <p className="text-xs text-muted-foreground">No new subscriptions in the last 30 days.</p>
        ) : (
          <div className="divide-y divide-border">
            {data.recentlySubscribed.map((o) => (
              <div key={o._id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium">{o.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {o.subscription?.plan} · {o.subscription?.status?.replace('_', ' ')}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(o.subscription?.subscribedAt)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
