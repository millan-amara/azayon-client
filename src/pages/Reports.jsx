import { useState } from 'react';
import { TrendingUp, Trophy, XCircle, Briefcase, Clock, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';
import { useReports } from '@/hooks/useData';
import { Card, Spinner } from '@/components/ui';
import { formatCurrency, cn } from '@/lib/utils';

const PRESETS = [
  { id: '7d',   label: 'Last 7 days' },
  { id: '30d',  label: 'Last 30 days' },
  { id: '90d',  label: 'Last 90 days' },
  { id: 'ytd',  label: 'This year' },
];

function StatCard(props) {
  const { icon: Icon, label, value, sub, accent } = props;
  return (
    <Card className="p-4 space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={cn('w-4 h-4', accent)} />
        <span>{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

export default function Reports() {
  const [presetId, setPresetId] = useState('30d');
  const { data, isLoading } = useReports(presetId);

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner /></div>;
  }
  if (!data) return null;

  const { totals, salesByRep, stageDistribution, avgDealCycleDays, revenueByMonth } = data;

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Date range presets */}
      <div className="flex items-center gap-1 p-0.5 rounded-lg border border-border bg-muted/30 self-start w-fit">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPresetId(p.id)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              presetId === p.id ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Trophy}
          label="Won"
          value={formatCurrency(totals.wonValue)}
          sub={`${totals.wonCount} deal${totals.wonCount === 1 ? '' : 's'}`}
          accent="text-green-600"
        />
        <StatCard
          icon={XCircle}
          label="Lost"
          value={formatCurrency(totals.lostValue)}
          sub={`${totals.lostCount} deal${totals.lostCount === 1 ? '' : 's'}`}
          accent="text-red-500"
        />
        <StatCard
          icon={TrendingUp}
          label="Win rate"
          value={totals.winRate != null ? `${totals.winRate}%` : '—'}
          sub={`${totals.wonCount + totals.lostCount} closed`}
          accent="text-primary"
        />
        <StatCard
          icon={Clock}
          label="Avg deal cycle"
          value={avgDealCycleDays != null ? `${Math.round(avgDealCycleDays)} days` : '—'}
          sub="creation → won"
          accent="text-amber-600"
        />
      </div>

      {/* Open pipeline snapshot */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Briefcase className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Open pipeline</h3>
          <span className="text-xs text-muted-foreground">
            · {totals.openCount} deal{totals.openCount === 1 ? '' : 's'} · {formatCurrency(totals.openValue)} total
          </span>
        </div>
        {stageDistribution.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No open deals</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stageDistribution.map((s) => ({ name: s._id, value: s.value, count: s.count }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}K` : v} />
              <Tooltip formatter={(v, k) => k === 'value' ? formatCurrency(v) : v} />
              <Bar dataKey="value" fill="#5046e4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sales by rep */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-green-600" />
            <h3 className="text-sm font-semibold">Top performers</h3>
          </div>
          {salesByRep.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No closed deals in this range</p>
          ) : (
            <div className="space-y-2">
              {salesByRep.map((rep) => {
                const max = Math.max(...salesByRep.map((r) => r.value));
                const pct = max > 0 ? (rep.value / max) * 100 : 0;
                return (
                  <div key={rep._id || rep.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{rep.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatCurrency(rep.value)} · {rep.count} deal{rep.count === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Revenue by month */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Revenue by month</h3>
          </div>
          {revenueByMonth.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No revenue in this range</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revenueByMonth.map((m) => ({ name: m.label, value: m.value }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}K` : v} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Line type="monotone" dataKey="value" stroke="#5046e4" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}
