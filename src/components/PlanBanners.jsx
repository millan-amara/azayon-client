import { useState } from 'react';
import { X, Zap, AlertTriangle } from 'lucide-react';
import { usePlan } from '@/context/PlanContext';
import { useUpgrade } from '@/components/Upgrade';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

// Trial countdown banner — shown during 7-day trial
export function TrialBanner() {
  const { billing, isTrialing, hasFullAccess } = usePlan();
  const { showUpgrade } = useUpgrade();
  const [dismissed, setDismissed] = useState(false);

  if (!isTrialing || !billing || dismissed) return null;

  const days = billing.trialDaysLeft;
  const isUrgent = days <= 2;

  return (
    <div className={cn(
      'flex items-center justify-between gap-3 px-4 py-2.5 text-sm',
      isUrgent
        ? 'bg-red-500 text-white'
        : 'bg-primary text-primary-foreground'
    )}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Zap className="w-4 h-4 shrink-0" />
        <p className="truncate">
          {days === 0
            ? 'Your free trial ends today — upgrade now to keep access'
            : days === 1
              ? 'Your free trial ends tomorrow'
              : `${days} days left on your free trial — you have full access to all Growth features`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          onClick={() => showUpgrade('automations')}
          className={cn(
            'h-7 text-xs font-semibold border-white/40',
            isUrgent
              ? 'text-white hover:bg-red-400 hover:text-white'
              : 'text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground'
          )}
        >
          Upgrade now
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded hover:opacity-70 transition-opacity"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// Past due / cancelled warning banner
export function PlanStatusBanner() {
  const { billing } = usePlan();
  const { showUpgrade } = useUpgrade();

  if (!billing) return null;
  if (billing.status !== 'past_due' && billing.status !== 'cancelled') return null;

  const isPastDue = billing.status === 'past_due';

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-500 text-white text-sm">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <p>
          {isPastDue
            ? 'Your last payment failed — update your payment method to keep access'
            : 'Your subscription has been cancelled — your data is safe but features are locked'}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => showUpgrade('automations')}
        className="h-7 text-xs font-semibold border-white/40 text-white hover:bg-amber-400 hover:text-white shrink-0"
      >
        {isPastDue ? 'Update payment' : 'Resubscribe'}
      </Button>
    </div>
  );
}

// Usage warning — shown when approaching contact/deal limits
export function UsageWarningBanner({ type, current, limit }) {
  const { showUpgrade } = useUpgrade();
  const [dismissed, setDismissed] = useState(false);
  const percentage = Math.round((current / limit) * 100);

  if (dismissed || percentage < 80) return null;

  const feature = type === 'contacts' ? 'contacts_limit' : 'deals_limit';
  const label = type === 'contacts' ? 'contacts' : 'deals';

  return (
    <div className="flex items-center justify-between gap-3 p-3 mb-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <div>
          <span className="font-medium text-amber-800">
            {current} of {limit} {label} used ({percentage}%)
          </span>
          {current >= limit && (
            <span className="text-amber-700"> — upgrade to add more</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" variant="outline" onClick={() => showUpgrade(feature)}
          className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100">
          Upgrade
        </Button>
        {current < limit && (
          <button onClick={() => setDismissed(true)} className="p-1 text-amber-600 hover:opacity-70">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}