import { createContext, useContext, useState } from 'react';
import { Sparkles, Zap, Lock, ArrowRight, X, CheckCircle2 } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { usePlan } from '@/context/PlanContext';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import toast from 'react-hot-toast';

// ─── FEATURE DEFINITIONS ─────────────────────────────────────────────────────
// Each locked feature has its own contextual copy

const FEATURE_COPY = {
  automations: {
    icon: '⚡',
    title: 'Automate your follow-ups',
    description: 'Set up automations that work while you sleep — follow up on cold deals, assign new leads, and trigger n8n workflows automatically.',
    benefit: 'Save 3+ hours a week on manual follow-ups',
  },
  ai: {
    icon: '✨',
    title: 'AI-powered sales tools',
    description: 'Get instant contact summaries, AI-drafted emails, and smart CSV column mapping — all powered by Claude AI.',
    benefit: 'Write better emails in seconds, not minutes',
  },
  attachments: {
    icon: '📎',
    title: 'Attach files to contacts & deals',
    description: 'Upload contracts, proposals, IDs, and photos directly to contacts and deals. Everything in one place.',
    benefit: 'Stop digging through WhatsApp for that document',
  },
  contacts_limit: {
    icon: '👥',
    title: "You've reached the 200 contact limit",
    description: 'Upgrade to Growth for unlimited contacts, plus automations, AI features, and file attachments.',
    benefit: 'Never stop adding leads',
  },
  deals_limit: {
    icon: '💼',
    title: "You've reached the 20 deal limit",
    description: 'Upgrade to Growth for unlimited deals in your pipeline, plus automations and AI tools.',
    benefit: 'Keep your whole pipeline visible',
  },
  users: {
    icon: '👤',
    title: 'Add more team members',
    description: 'The Free plan is for solo users. Upgrade to Growth to add up to 5 team members.',
    benefit: 'Run your CRM as a team',
  },
  webhooks: {
    icon: '🔗',
    title: 'Connect to n8n & external tools',
    description: 'Use webhook automations to connect your CRM to n8n, Slack, Google Sheets, and any other tool.',
    benefit: 'Build powerful workflows with no extra cost',
  },
};

const PRICES = [
  {
    key: 'growth_monthly',
    label: 'Growth',
    price: 'KES 3,000',
    period: '/month',
    badge: 'Most popular',
    badgeColor: 'bg-primary/10 text-primary',
    highlight: true,
    features: ['5 users', 'Unlimited contacts & deals', 'Full automations', 'AI features', 'File attachments', 'n8n / webhooks'],
  },
  {
    key: 'growth_annual',
    label: 'Growth (Annual)',
    price: 'KES 25,000',
    period: '/year',
    badge: '2 months free',
    badgeColor: 'bg-green-100 text-green-700',
    highlight: false,
    features: ['Everything in Growth monthly', 'Save KES 11,000/year'],
  },
];

// ─── UPGRADE CONTEXT ──────────────────────────────────────────────────────────

const UpgradeContext = createContext(null);

export function UpgradeProvider({ children }) {
  const [state, setState] = useState({ open: false, feature: null });

  const showUpgrade = (feature = 'automations') => setState({ open: true, feature });
  const hide = () => setState({ open: false, feature: null });

  return (
    <UpgradeContext.Provider value={{ showUpgrade }}>
      {children}
      <UpgradeModal open={state.open} feature={state.feature} onClose={hide} />
    </UpgradeContext.Provider>
  );
}

export function useUpgrade() {
  const ctx = useContext(UpgradeContext);
  if (!ctx) throw new Error('useUpgrade must be used inside UpgradeProvider');
  return ctx;
}

// ─── UPGRADE MODAL ────────────────────────────────────────────────────────────

function UpgradeModal({ open, feature, onClose }) {
  const { billing, refetch } = usePlan();
  const [loading, setLoading] = useState(null); // which price key is loading
  const copy = FEATURE_COPY[feature] || FEATURE_COPY.automations;

  const handleCheckout = async (priceKey) => {
    setLoading(priceKey);
    try {
      const { data } = await api.post('/billing/initialize', { priceKey });
      window.location.href = data.authorizationUrl;
    } catch (err) {
      toast.error('Could not start checkout — please try again');
      setLoading(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="">
      <div className="space-y-5">
        {/* Feature highlight */}
        <div className="text-center pb-2">
          <div className="text-4xl mb-3">{copy.icon}</div>
          <h2 className="text-lg font-bold">{copy.title}</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">{copy.description}</p>
          <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {copy.benefit}
          </div>
        </div>

        {/* Pricing options */}
        <div className="space-y-2">
          {PRICES.map((plan) => (
            <div
              key={plan.key}
              className={cn(
                'border rounded-xl p-4 transition-all',
                plan.highlight ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{plan.label}</p>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', plan.badgeColor)}>
                      {plan.badge}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-0.5 mt-1">
                    <span className="text-xl font-bold">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
                    {plan.features.map((f) => (
                      <span key={f} className="text-xs text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" /> {f}
                      </span>
                    ))}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={plan.highlight ? 'default' : 'outline'}
                  className="shrink-0 self-start"
                  loading={loading === plan.key}
                  onClick={() => handleCheckout(plan.key)}
                >
                  {plan.highlight ? 'Upgrade' : 'Choose'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Secure payment via Paystack · M-Pesa, cards & bank transfer accepted · Cancel anytime
        </p>
      </div>
    </Modal>
  );
}

// ─── LOCKED FEATURE WRAPPER ───────────────────────────────────────────────────
// Wraps any component — shows it greyed out with a lock overlay

export function LockedFeature({ feature, children, inline = false }) {
  const { hasFullAccess } = usePlan();
  const { showUpgrade } = useUpgrade();

  if (hasFullAccess) return children;

  if (inline) {
    return (
      <button
        onClick={() => showUpgrade(feature)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <Lock className="w-3.5 h-3.5" />
        <span>{FEATURE_COPY[feature]?.title || 'Upgrade to unlock'}</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <div className="pointer-events-none opacity-40 select-none">{children}</div>
      <div
        className="absolute inset-0 flex items-center justify-center cursor-pointer rounded-xl"
        onClick={() => showUpgrade(feature)}
      >
        <div className="bg-background/95 border border-border rounded-xl px-4 py-3 shadow-md text-center max-w-xs">
          <Lock className="w-4 h-4 text-primary mx-auto mb-1.5" />
          <p className="text-sm font-semibold">{FEATURE_COPY[feature]?.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{FEATURE_COPY[feature]?.benefit}</p>
          <div className="flex items-center justify-center gap-1 mt-2 text-xs text-primary font-medium">
            Upgrade to unlock <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── UPGRADE BUTTON ───────────────────────────────────────────────────────────
// Simple "upgrade to use this" button used inline next to locked actions

export function UpgradeButton({ feature, label, size = 'sm', className }) {
  const { showUpgrade } = useUpgrade();
  return (
    <Button
      size={size}
      variant="outline"
      onClick={() => showUpgrade(feature)}
      className={cn('gap-1.5 border-primary/30 text-primary hover:bg-primary/5', className)}
    >
      <Zap className="w-3.5 h-3.5" />
      {label || 'Upgrade to unlock'}
    </Button>
  );
}