import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, UserPlus, KanbanSquare, MessageCircle, Check, ArrowRight, Sparkles,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  useUpdateOrg, useUpdateOnboarding, useCreateContact, usePipelines, useUpdateUser,
} from '@/hooks/useData';
import { Button, Input, Select, Modal } from '@/components/ui';
import toast from 'react-hot-toast';

// ─── Constants — matches Settings tab options ────────────────────────────────
const CURRENCIES = [
  { code: 'KES', label: 'KES — Kenyan Shilling' },
  { code: 'UGX', label: 'UGX — Ugandan Shilling' },
  { code: 'TZS', label: 'TZS — Tanzanian Shilling' },
  { code: 'RWF', label: 'RWF — Rwandan Franc' },
  { code: 'NGN', label: 'NGN — Nigerian Naira' },
  { code: 'GHS', label: 'GHS — Ghanaian Cedi' },
  { code: 'ZAR', label: 'ZAR — South African Rand' },
  { code: 'USD', label: 'USD — US Dollar' },
];

const TIMEZONES = [
  { code: 'Africa/Nairobi', label: 'Nairobi / Kampala / Dar es Salaam (UTC+3)' },
  { code: 'Africa/Lagos', label: 'Lagos / Accra (UTC+1)' },
  { code: 'Africa/Johannesburg', label: 'Johannesburg / Kigali (UTC+2)' },
  { code: 'Africa/Cairo', label: 'Cairo (UTC+2)' },
  { code: 'UTC', label: 'UTC' },
];

const COUNTRY_CODES = [
  { code: '+254', flag: '🇰🇪' }, { code: '+256', flag: '🇺🇬' },
  { code: '+255', flag: '🇹🇿' }, { code: '+250', flag: '🇷🇼' },
  { code: '+234', flag: '🇳🇬' }, { code: '+233', flag: '🇬🇭' },
  { code: '+27',  flag: '🇿🇦' },
];

// ─── Each step ───────────────────────────────────────────────────────────────

function StepBusinessInfo({ org, onNext, onSkip }) {
  const { updateOrg } = useAuth();
  const { mutateAsync, isPending } = useUpdateOrg();
  const [name, setName] = useState(org?.name || '');
  const [currency, setCurrency] = useState(org?.settings?.currency || 'KES');
  const [timezone, setTimezone] = useState(org?.settings?.timezone || 'Africa/Nairobi');

  const handleNext = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Please enter your business name');
    const data = await mutateAsync({
      name: name.trim(),
      settings: { currency, timezone },
    });
    if (data?.org) updateOrg(data.org);
    onNext();
  };

  return (
    <form onSubmit={handleNext} className="space-y-4">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 mx-auto flex items-center justify-center mb-2">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">Tell us about your business</h2>
        <p className="text-sm text-muted-foreground mt-1">
          We'll use this to format dates, money and reminders correctly.
        </p>
      </div>
      <Input
        label="Business name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Acme Ltd"
        required
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select
          label="Currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          options={CURRENCIES.map((c) => ({ value: c.code, label: c.label }))}
        />
        <Select
          label="Time zone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          options={TIMEZONES.map((t) => ({ value: t.code, label: t.label }))}
        />
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onSkip}>Skip</Button>
        <Button type="submit" className="flex-1" loading={isPending}>
          Continue <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </form>
  );
}

function StepFirstContact({ onNext, onSkip }) {
  const { mutateAsync, isPending } = useCreateContact();
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', company: '' });

  const handleNext = async (e) => {
    e.preventDefault();
    if (!form.firstName.trim()) return toast.error('First name is required');
    await mutateAsync(form);
    onNext();
  };

  return (
    <form onSubmit={handleNext} className="space-y-4">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-teal-100 mx-auto flex items-center justify-center mb-2">
          <UserPlus className="w-5 h-5 text-teal-600" />
        </div>
        <h2 className="text-lg font-semibold">Add your first contact</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Just enough to test things out — you can import more later from CSV.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="First name" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} required />
        <Input label="Last name" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
      </div>
      <Input label="Company" value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder="Optional" />
      <Input label="Phone (with country code)" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+254712345678" />
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onSkip}>Skip</Button>
        <Button type="submit" className="flex-1" loading={isPending}>
          Add contact <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </form>
  );
}

function StepPipeline({ onNext }) {
  const navigate = useNavigate();
  const { data } = usePipelines();
  const defaultPipeline = data?.pipelines?.find((p) => p.isDefault) || data?.pipelines?.[0];
  const stages = (defaultPipeline?.stages || []).filter((s) => !s.isWon && !s.isLost).sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-amber-100 mx-auto flex items-center justify-center mb-2">
          <KanbanSquare className="w-5 h-5 text-amber-600" />
        </div>
        <h2 className="text-lg font-semibold">Your sales pipeline is ready</h2>
        <p className="text-sm text-muted-foreground mt-1">
          We've set up a default pipeline you can start using right away. You can rename or add stages anytime in Settings.
        </p>
      </div>
      <div className="bg-muted/30 rounded-xl p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">{defaultPipeline?.name || 'Sales Pipeline'}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {stages.map((s, i) => (
            <span key={s._id} className="flex items-center gap-1.5">
              <span className="bg-background px-2 py-1 rounded-md border border-border text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.name}
              </span>
              {i < stages.length - 1 && <span className="text-muted-foreground/40 text-xs">→</span>}
            </span>
          ))}
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={() => { onNext(); setTimeout(() => navigate('/settings?tab=pipelines'), 200); }}>
          Customise stages
        </Button>
        <Button className="flex-1" onClick={onNext}>
          Looks good <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function StepWhatsApp({ user, onFinish, onSkip, finishing }) {
  const { updateUser } = useAuth();
  const { mutateAsync, isPending } = useUpdateUser();
  const [code, setCode] = useState('+254');
  const [number, setNumber] = useState('');

  const save = async (e) => {
    e.preventDefault();
    if (!number) return toast.error('Enter your phone number');
    const cleaned = number.replace(/\D/g, '').replace(/^0+/, '');
    const phone = `${code}${cleaned}`;
    const data = await mutateAsync({ id: user._id, phone });
    if (data?.user) updateUser(data.user);
    onFinish();
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 mx-auto flex items-center justify-center mb-2">
          <MessageCircle className="w-5 h-5 text-green-600" />
        </div>
        <h2 className="text-lg font-semibold">Add your WhatsApp number</h2>
        <p className="text-sm text-muted-foreground mt-1">
          We'll send your task reminders here, and use it as the "from" number when you message customers from Azayon.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Phone number</label>
        <div className="flex gap-2">
          <select
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="h-9 pl-2 pr-1 rounded-lg border border-border bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
          >
            {COUNTRY_CODES.map((c) => (
              <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
            ))}
          </select>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="712 345 678"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="flex h-9 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onSkip} disabled={finishing || isPending}>Skip</Button>
        <Button type="submit" className="flex-1" loading={isPending || finishing}>
          <Check className="w-4 h-4" /> Finish setup
        </Button>
      </div>
    </form>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function OnboardingWizard({ open, onClose }) {
  const { user, org, updateOrg } = useAuth();
  const { mutateAsync: setOnboarding, isPending: finishing } = useUpdateOnboarding();
  const [step, setStep] = useState(0);

  const finish = async (markCompleted = true) => {
    const payload = markCompleted ? { completed: true } : { skipped: true };
    const data = await setOnboarding(payload).catch(() => null);
    if (data?.org) updateOrg(data.org);
    onClose();
  };

  const skipAll = () => finish(false);
  const next = () => setStep((s) => s + 1);

  const totalSteps = 4;
  const progress = Math.min(((step) / totalSteps) * 100, 100);

  return (
    <Modal open={open} onClose={skipAll} title="">
      <div className="space-y-5">
        {/* Header w/ progress */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Welcome to Azayon · Step {step + 1} of {totalSteps}</span>
          </div>
          <button
            onClick={skipAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Skip for now"
          >
            Skip all
          </button>
        </div>
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {step === 0 && <StepBusinessInfo org={org} onNext={next} onSkip={next} />}
        {step === 1 && <StepFirstContact onNext={next} onSkip={next} />}
        {step === 2 && <StepPipeline onNext={next} />}
        {step === 3 && <StepWhatsApp user={user} onFinish={() => finish(true)} onSkip={() => finish(true)} finishing={finishing} />}
      </div>
    </Modal>
  );
}
