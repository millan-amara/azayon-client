import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, Spinner, Badge } from '@/components/ui';

const MONGO_STATE = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

function formatUptime(s) {
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days) return `${days}d ${hours}h ${mins}m`;
  if (hours) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export default function System() {
  const { data, isLoading } = useQuery({
    queryKey: ['superadmin', 'system'],
    queryFn: () => api.get('/superadmin/system').then((r) => r.data),
    refetchInterval: 30_000,
  });

  if (isLoading || !data) return <div className="flex justify-center py-16"><Spinner /></div>;

  const mongoState = MONGO_STATE[data.mongo?.readyState] || 'unknown';

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card className="p-5 space-y-3">
        <p className="text-sm font-semibold">Server</p>
        <Row label="Node version"  value={data.node} />
        <Row label="Environment"   value={data.env} />
        <Row label="PID"           value={data.pid} />
        <Row label="Uptime"        value={formatUptime(data.uptimeSec)} />
        <Row label="Memory · RSS"  value={`${data.memoryMB.rss} MB`} />
        <Row label="Memory · heap" value={`${data.memoryMB.heapUsed} / ${data.memoryMB.heapTotal} MB`} />
      </Card>

      <Card className="p-5 space-y-3">
        <p className="text-sm font-semibold">MongoDB</p>
        <Row
          label="Status"
          value={
            <Badge variant={mongoState === 'connected' ? 'success' : 'danger'}>
              {mongoState}
            </Badge>
          }
        />
        <Row label="Database" value={data.mongo?.name || '—'} />
        <Row label="Host"     value={data.mongo?.host || '—'} />
        <p className="text-[11px] text-muted-foreground pt-2">
          Refreshes every 30s. As of {new Date(data.timestamp).toLocaleString()}.
        </p>
      </Card>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
