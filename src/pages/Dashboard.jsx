import { Users, TrendingUp, CheckSquare, AlertCircle, Trophy, XCircle, Briefcase, UserPlus, Activity } from 'lucide-react';
import { useDashboard, useDashboardActivity } from '@/hooks/useData';
import { useAuth } from '@/context/AuthContext';
import { StatCard, Card, Spinner } from '@/components/ui';
import { formatCurrency, timeAgo, CONTACT_STATUS_COLORS, cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Link } from 'react-router-dom';

// ─── Activity feed panel ─────────────────────────────────────────────────────

const ACTIVITY_ICONS = {
  deal_won:        { Icon: Trophy,    className: 'text-green-600 bg-green-50' },
  deal_lost:       { Icon: XCircle,   className: 'text-red-500 bg-red-50' },
  deal_created:    { Icon: Briefcase, className: 'text-primary bg-primary/10' },
  contact_created: { Icon: UserPlus,  className: 'text-teal-600 bg-teal-50' },
};

function activityHref(item) {
  if (!item.resourceId) return null;
  if (item.resourceType === 'deal')    return `/deals/${item.resourceId}`;
  if (item.resourceType === 'contact') return `/contacts/${item.resourceId}`;
  return null;
}

function activityLine(item) {
  const actor = item.actor || 'Someone';
  const amount = item.amount != null ? formatCurrency(item.amount, item.currency) : null;
  const fromContact = item.contactName ? ` from ${item.contactName}` : '';
  switch (item.type) {
    case 'deal_won':
      return <><strong>{actor}</strong> won <strong>{item.target}</strong>{amount ? ` for ${amount}` : ''}{fromContact}</>;
    case 'deal_lost':
      return <><strong>{actor}</strong> marked <strong>{item.target}</strong> as lost{fromContact}</>;
    case 'deal_created':
      return <><strong>{actor}</strong> created deal <strong>{item.target}</strong>{amount ? ` (${amount})` : ''}{fromContact}</>;
    case 'contact_created':
      return <><strong>{actor}</strong> added <strong>{item.target}</strong></>;
    default:
      return <>{actor} · {item.target}</>;
  }
}

function ActivityFeed() {
  const { data, isLoading } = useDashboardActivity(15);
  const items = data?.activity || [];

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">What's happening</h3>
        </div>
        <span className="text-xs text-muted-foreground">Last {items.length} events</span>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No activity yet — once your team logs deals and contacts, the feed lights up here.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => {
            const { Icon, className } = ACTIVITY_ICONS[item.type] || { Icon: Activity, className: 'text-muted-foreground bg-muted' };
            const href = activityHref(item);
            const content = (
              <div className="flex items-start gap-3 group">
                <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5', className)}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm leading-snug', href && 'group-hover:text-primary transition-colors')}>
                    {activityLine(item)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(item.when)}</p>
                </div>
              </div>
            );
            return href
              ? <Link key={i} to={href}>{content}</Link>
              : <div key={i}>{content}</div>;
          })}
        </div>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useDashboard();

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Spinner />
    </div>
  );

  const d = data || {};
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">{greeting}, {user?.name?.split(' ')[0]} 👋</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Here's what's happening with your pipeline today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total contacts"
          value={d.contacts?.total?.toLocaleString() || '0'}
          sub={`+${d.contacts?.newThisMonth || 0} this month`}
          icon={Users}
          color="blue"
        />
        <StatCard
          label="Open deals"
          value={d.deals?.openCount || 0}
          sub={formatCurrency(d.deals?.openValue)}
          icon={TrendingUp}
          color="primary"
        />
        <StatCard
          label="Won this month"
          value={d.deals?.wonThisMonth || 0}
          sub={formatCurrency(d.deals?.wonValueThisMonth)}
          trend={d.deals?.valueGrowth}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          label="Tasks overdue"
          value={d.tasks?.overdue || 0}
          // Headline is overdue; subtitle adds context. When overdue > 0,
          // "needs attention" reinforces the alert state (and avoids the
          // confusing "0 due today" sitting under a "2 overdue" number).
          // When overdue is 0, the "due today" count is useful look-ahead info.
          sub={d.tasks?.overdue > 0 ? 'Needs attention' : `${d.tasks?.dueToday || 0} due today`}
          icon={d.tasks?.overdue > 0 ? AlertCircle : CheckSquare}
          color={d.tasks?.overdue > 0 ? 'red' : 'amber'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline by stage chart */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-4">Pipeline by stage</h3>
          {d.dealValueByStage?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={d.dealValueByStage} layout="vertical" margin={{ left: 0, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="_id"
                  width={110}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(v) => formatCurrency(v)}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="totalValue" radius={[0, 4, 4, 0]}>
                  {d.dealValueByStage.map((_, i) => (
                    <Cell
                      key={i}
                      fill={`hsl(${262 + i * 15}, 70%, ${60 - i * 3}%)`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">No open deals yet</p>
          )}
        </Card>

        {/* Recent contacts */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Recent contacts</h3>
            <Link to="/contacts" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {d.recentContacts?.length > 0 ? d.recentContacts.map((c) => (
              <Link
                key={c._id}
                to={`/contacts/${c._id}`}
                className="flex items-center gap-3 group"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                  {(c.firstName?.[0] || '') + (c.lastName?.[0] || '')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {c.firstName} {c.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{c.company || c.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', CONTACT_STATUS_COLORS[c.status])}>
                    {c.status}
                  </span>
                  <span className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
                </div>
              </Link>
            )) : (
              <p className="text-sm text-muted-foreground text-center py-8">No contacts yet</p>
            )}
          </div>
        </Card>
      </div>

      <ActivityFeed />

      {/* Quick actions */}
      <div className="flex gap-3 flex-wrap">
        <Link to="/contacts">
          <button className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium transition-colors">
            + Add contact
          </button>
        </Link>
        <Link to="/pipeline">
          <button className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium transition-colors">
            + New deal
          </button>
        </Link>
        <Link to="/tasks">
          <button className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium transition-colors">
            + Create task
          </button>
        </Link>
      </div>
    </div>
  );
}