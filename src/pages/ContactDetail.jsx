import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, MessageCircle, Phone, Mail, Edit2, Trash2,
  Plus, Clock, FileText, PhoneCall, AtSign,
  Sparkles, Copy, Check, RefreshCw, X,
  Building2, MapPin, Cake, Heart, CalendarDays, User as UserIcon,
} from 'lucide-react';
import { useContact, useUpdateContact, useAddTimeline, useTeam, useDeleteContact, useCustomFields } from '@/hooks/useData';
import { useRole } from '@/hooks/useRole';
import {
  Button, Card, Badge, Modal, Input, Select,
  Textarea, Spinner, EmptyState, Avatar,
} from '@/components/ui';
import { Attachments } from '@/components/Attachments';
import {
  formatDate, timeAgo, CONTACT_STATUS_COLORS, DEAL_STATUS_COLORS,
  formatCurrency, getWhatsAppUrl, cn
} from '@/lib/utils';
import { callClaudeStream } from '@/lib/ai';
import { usePlan } from '@/context/PlanContext';
import { UpgradeButton } from '@/components/Upgrade';
import toast from 'react-hot-toast';

const TIMELINE_ICONS = {
  note: FileText,
  call: PhoneCall,
  email: AtSign,
  whatsapp: MessageCircle,
  deal_created: Plus,
  deal_updated: Edit2,
  system: Clock,
};

function AISummaryPanel({ contact, deals }) {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const { canUse } = usePlan();

  const generate = async () => {
    setVisible(true);
    setLoading(true);
    setSummary('');

    const timelineText = (contact.timeline || []).slice(0, 20)
      .map((e) => `[${e.type}] ${e.content}`).join('\n');

    const dealsText = deals.map((d) =>
      `Deal: ${d.title} | Stage: ${d.stageName} | Value: ${d.value} | Status: ${d.status}`
    ).join('\n');

    try {
      await callClaudeStream({
        systemPrompt: `You are a sales assistant for a CRM. Write concise, professional sales briefings.
Focus on: current relationship status, what has been discussed, what is at stake, and the recommended next action.
Write in 3-4 sentences max. Be direct and actionable. No fluff.`,
        userPrompt: `Summarize this contact for a sales rep about to reach out:

Contact: ${contact.firstName} ${contact.lastName}
Company: ${contact.company || 'Unknown'}
Status: ${contact.status}
Phone: ${contact.phone || 'N/A'}
Email: ${contact.email || 'N/A'}

Recent activity:
${timelineText || 'No activity logged yet'}

Deals:
${dealsText || 'No deals yet'}

Write a 3-4 sentence briefing: who this person is, where things stand, what the rep should do next.`,
        maxTokens: 300,
        onChunk: (_, full) => setSummary(full),
      });
    } catch {
      toast.error('Failed to generate summary');
      setVisible(false);
    } finally {
      setLoading(false);
    }
  };

  // CTA state (no AI yet) and result state share the same framing so the
  // sidebar slot stays a consistent shape regardless of whether the rep has
  // generated a summary yet.
  if (!canUse('ai')) {
    return (
      <div className="border border-dashed border-border rounded-xl p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <p className="text-sm font-medium truncate">AI Summary</p>
        </div>
        <UpgradeButton feature="ai" label="Upgrade" />
      </div>
    );
  }

  if (!visible) {
    return (
      <button
        onClick={generate}
        className="w-full text-left border border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 rounded-xl p-4 transition-colors"
      >
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-primary">AI Summary</p>
        </div>
        <p className="text-xs text-muted-foreground">Get a 3-line briefing on this contact before you reach out.</p>
      </button>
    );
  }

  return (
    <div className="border border-primary/20 rounded-xl bg-primary/5 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">AI Summary</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={generate} className="p-1 rounded hover:bg-primary/10 transition-colors" title="Regenerate">
            <RefreshCw className={cn('w-3.5 h-3.5 text-primary', loading && 'animate-spin')} />
          </button>
          <button onClick={() => setVisible(false)} className="p-1 rounded hover:bg-primary/10 transition-colors">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
      {loading && !summary ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner className="w-3 h-3" /> Analysing contact...
        </div>
      ) : (
        <p className="text-sm text-foreground leading-relaxed">{summary}</p>
      )}
    </div>
  );
}

const EMAIL_INTENTS = [
  { value: 'follow_up', label: '🔁 Follow up' },
  { value: 'introduction', label: '👋 Introduction' },
  { value: 'proposal', label: '📋 Send proposal' },
  { value: 'reengage', label: '💬 Re-engage' },
  { value: 'check_in', label: '☎️ Check in' },
];

function EmailDraftModal({ open, onClose, contact, deals }) {
  const [intent, setIntent] = useState('follow_up');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generated, setGenerated] = useState(false);

  const generate = async () => {
    setLoading(true);
    setDraft('');
    setGenerated(false);

    const timelineText = (contact.timeline || []).slice(0, 10)
      .map((e) => `[${e.type}] ${e.content}`).join('\n');

    const latestDeal = deals[0];
    const intentLabels = {
      follow_up: 'a follow-up after previous contact',
      introduction: 'a first introduction',
      proposal: 'sending or following up on a proposal',
      reengage: 're-engaging after a period of no contact',
      check_in: 'a friendly check-in',
    };

    try {
      await callClaudeStream({
        systemPrompt: `You are a professional sales email writer for an African business.
Write emails that are warm, professional, and concise.
Use clear English that feels personal, not corporate.
Format: Subject line on the very first line starting with "Subject: ", then a blank line, then the email body.
Keep emails to 3-5 short paragraphs. End with a clear single call to action.`,
        userPrompt: `Write ${intentLabels[intent]} email for:

Contact: ${contact.firstName} ${contact.lastName}
Company: ${contact.company || 'their company'}
Email: ${contact.email || 'N/A'}
${latestDeal ? `Latest deal: ${latestDeal.title} (${latestDeal.stageName}, KES ${latestDeal.value})` : ''}

Recent interactions:
${timelineText || 'No previous interactions logged'}

Write a professional email. First line must be "Subject: ..." followed by blank line then the email body.`,
        maxTokens: 500,
        onChunk: (_, full) => setDraft(full),
      });
      setGenerated(true);
    } catch {
      toast.error('Failed to generate email');
    } finally {
      setLoading(false);
    }
  };

  const copyEmail = () => {
    navigator.clipboard.writeText(draft);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const openInMail = () => {
    const lines = draft.split('\n');
    const subjectLine = lines.find((l) => l.startsWith('Subject:'));
    const subject = subjectLine ? subjectLine.replace('Subject:', '').trim() : '';
    const body = lines.filter((l) => !l.startsWith('Subject:')).join('\n').trim();
    window.location.href = `mailto:${contact.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => { setDraft(''); setGenerated(false); setIntent('follow_up'); }, 300);
  };

  return (
    <Modal open={open} onClose={handleClose} title="Draft email with AI" className="max-w-2xl">
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">What kind of email?</label>
          <div className="flex flex-wrap gap-2">
            {EMAIL_INTENTS.map((i) => (
              <button key={i.value} onClick={() => { setIntent(i.value); setGenerated(false); setDraft(''); }}
                className={cn('px-3 py-1.5 rounded-lg text-sm border transition-all',
                  intent === i.value ? 'border-primary bg-primary/5 font-medium text-primary' : 'border-border hover:border-primary/40'
                )}>
                {i.label}
              </button>
            ))}
          </div>
        </div>

        {!generated && !loading && (
          <Button className="w-full" onClick={generate}>
            <Sparkles className="w-4 h-4" /> Generate email
          </Button>
        )}

        {(loading || generated) && (
          <div className="space-y-3">
            <div className="relative">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={12}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder={loading ? 'Writing your email...' : ''}
                readOnly={loading}
              />
              {loading && (
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 text-xs text-muted-foreground bg-background px-2 py-1 rounded border border-border">
                  <Sparkles className="w-3 h-3 animate-pulse text-primary" /> Writing...
                </div>
              )}
            </div>
            {generated && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={generate}>
                  <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                </Button>
                <div className="flex-1" />
                {contact.email && (
                  <Button variant="outline" size="sm" onClick={openInMail}>
                    <Mail className="w-3.5 h-3.5" /> Open in Mail
                  </Button>
                )}
                <Button size="sm" onClick={copyEmail}>
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function TimelineEntry({ entry }) {
  const Icon = TIMELINE_ICONS[entry.type] || Clock;
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 pb-4 border-b border-border last:border-0">
        <p className="text-sm">{entry.content}</p>
        <p className="text-xs text-muted-foreground mt-1">{timeAgo(entry.createdAt)}</p>
      </div>
    </div>
  );
}

function AddLogModal({ open, onClose, contactId }) {
  const { mutateAsync, isPending } = useAddTimeline();
  const [type, setType] = useState('note');
  const [content, setContent] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    await mutateAsync({ id: contactId, type, content });
    setContent('');
    onClose();
    toast.success('Activity logged');
  };

  return (
    <Modal open={open} onClose={onClose} title="Log activity">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}
          options={[{ value: 'note', label: '📝 Note' }, { value: 'call', label: '📞 Call' }, { value: 'email', label: '✉️ Email' }, { value: 'whatsapp', label: '💬 WhatsApp' }]} />
        <Textarea label="Notes" placeholder="What happened?" value={content} onChange={(e) => setContent(e.target.value)} required rows={4} />
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isPending}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

// Mongo Maps serialize to plain objects over JSON. Normalize either form.
function readCustomFields(contact) {
  const cf = contact?.customFields;
  if (!cf) return {};
  if (cf instanceof Map) return Object.fromEntries(cf);
  return { ...cf };
}

function EditContactModal({ open, onClose, contact }) {
  const { mutateAsync, isPending } = useUpdateContact();
  const { data: teamData } = useTeam();
  const { data: customFieldsData } = useCustomFields('contact');
  const customFields = customFieldsData?.fields || [];

  const [form, setForm] = useState({
    firstName: contact.firstName || '', lastName: contact.lastName || '',
    email: contact.email || '', phone: contact.phone || '',
    company: contact.company || '', jobTitle: contact.jobTitle || '',
    status: contact.status || 'lead', notes: contact.notes || '',
    assignedTo: contact.assignedTo?._id || contact.assignedTo || '',
    birthday:    contact.birthday    ? new Date(contact.birthday).toISOString().slice(0, 10)    : '',
    anniversary: contact.anniversary ? new Date(contact.anniversary).toISOString().slice(0, 10) : '',
  });
  const [customValues, setCustomValues] = useState(() => readCustomFields(contact));

  // Default expanded if the contact already has any "more" data — so users
  // can immediately see/edit what they came here for.
  const hasExtras =
    !!form.birthday ||
    !!form.anniversary ||
    Object.values(customValues).some((v) => v !== '' && v != null);
  const [showMore, setShowMore] = useState(hasExtras);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setCustom = (key) => (e) => setCustomValues((v) => ({ ...v, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    for (const f of customFields) {
      if (f.required && !customValues[f.key]) {
        toast.error(`${f.label} is required`);
        return;
      }
    }
    const updates = { ...form };
    if (!updates.assignedTo) delete updates.assignedTo;
    // Empty date strings would break Mongoose Date casting — convert to null to clear, or strip
    if (!updates.birthday)    updates.birthday = null;
    if (!updates.anniversary) updates.anniversary = null;
    if (customFields.length > 0) updates.customFields = customValues;
    await mutateAsync({ id: contact._id, ...updates });
    onClose();
  };

  const teamMembers = (teamData?.users || []).filter((u) => u.isActive !== false);

  return (
    <Modal open={open} onClose={onClose} title="Edit contact" className="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="First name *" value={form.firstName} onChange={set('firstName')} required autoFocus />
          <Input label="Last name" value={form.lastName} onChange={set('lastName')} />
        </div>

        <Input label="Email" type="email" placeholder="jane@example.com" value={form.email} onChange={set('email')} />
        <Input label="Phone" placeholder="+254 712 345 678" value={form.phone} onChange={set('phone')} />

        <div className="grid grid-cols-2 gap-4">
          <Input label="Company" value={form.company} onChange={set('company')} />
          <Input label="Job title" value={form.jobTitle} onChange={set('jobTitle')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select label="Status" value={form.status} onChange={set('status')}
            options={[{ value: 'lead', label: 'Lead' }, { value: 'prospect', label: 'Prospect' }, { value: 'customer', label: 'Customer' }, { value: 'churned', label: 'Churned' }]} />
          <Select
            label="Assigned to"
            value={form.assignedTo}
            onChange={set('assignedTo')}
            options={[
              { value: '', label: 'Unassigned' },
              ...teamMembers.map((u) => ({
                value: u._id,
                label: u.role === 'viewer' ? `${u.name} (viewer)` : u.name,
              })),
            ]}
          />
        </div>

        <Textarea label="Notes" value={form.notes} onChange={set('notes')} rows={3} />

        {showMore && (
          <div className="grid grid-cols-2 gap-4">
            <Input label="Birthday" type="date" value={form.birthday} onChange={set('birthday')} />
            <Input label="Anniversary" type="date" value={form.anniversary} onChange={set('anniversary')} />
          </div>
        )}

        {showMore && customFields.length > 0 && (
          <div className="space-y-4">
            {customFields.map((f) => {
              const label = f.label + (f.required ? ' *' : '');
              if (f.type === 'select') {
                return (
                  <Select
                    key={f._id}
                    label={label}
                    value={customValues[f.key] || ''}
                    onChange={setCustom(f.key)}
                    options={[{ value: '', label: 'Select…' }, ...f.options.map((o) => ({ value: o, label: o }))]}
                    required={f.required}
                  />
                );
              }
              return (
                <Input
                  key={f._id}
                  label={label}
                  type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                  value={customValues[f.key] || ''}
                  onChange={setCustom(f.key)}
                  required={f.required}
                />
              );
            })}
          </div>
        )}

        {!showMore && (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="text-sm text-primary hover:underline"
          >
            + Add birthday, anniversary{customFields.length > 0 ? ' and more' : ''}
          </button>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isPending}>Save changes</Button>
        </div>
      </form>
    </Modal>
  );
}

// Compact icon + label/value row used throughout the right sidebar. Skips
// itself when the value is empty so we don't render a half-blank info card.
// `icon` is rendered JSX (e.g. `<Mail className="..." />`), passed by the
// caller — keeps the API simple and dodges ESLint's JSX-as-variable confusion.
function InfoRow({ icon, label, value, href }) {
  if (value == null || value === '') return null;
  const valueNode = href
    ? <a href={href} className="text-sm font-medium text-foreground hover:text-primary truncate block" target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{value}</a>
    : <p className="text-sm font-medium text-foreground truncate">{value}</p>;
  return (
    <div className="flex items-start gap-3">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
        {valueNode}
      </div>
    </div>
  );
}

// Read-only block that shows custom field values. Returns null when there's
// nothing to render — callers should NOT wrap it in a card themselves; this
// component owns its own framing so the sidebar doesn't end up with empty
// hollow cards.
function CustomFieldsDisplay({ contact, fields }) {
  const values = readCustomFields(contact);
  // Only show fields that have a value
  const populated = fields.filter((f) => values[f.key] != null && values[f.key] !== '');
  if (populated.length === 0) return null;

  const formatValue = (f, raw) => {
    if (f.type === 'date') {
      try { return formatDate(raw); } catch { return raw; }
    }
    if (f.type === 'number') {
      const n = Number(raw);
      return Number.isFinite(n) ? n.toLocaleString('en-KE') : raw;
    }
    return String(raw);
  };

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold mb-3">Additional info</h3>
      <div className="space-y-3">
        {populated.map((f) => (
          <div key={f._id}>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{f.label}</p>
            <p className="text-sm font-medium mt-0.5 truncate">{formatValue(f, values[f.key])}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useContact(id);
  const { data: customFieldsData } = useCustomFields('contact');
  const customFieldDefs = customFieldsData?.fields || [];
  const { canWrite } = useRole();
  const { canUse } = usePlan();
  const { mutate: deleteContact } = useDeleteContact();
  const [showLog, setShowLog] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showEmailDraft, setShowEmailDraft] = useState(false);
  const [activeTab, setActiveTab] = useState('timeline');

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!data) return <p className="text-center py-20 text-muted-foreground">Contact not found</p>;

  const { contact, deals = [], tasks = [] } = data;
  const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Contact';
  const waUrl = getWhatsAppUrl(contact.phone, `Hi ${contact.firstName},`);
  const openTasks = tasks.filter((t) => t.status !== 'completed');
  const openDeals = deals.filter((d) => d.status === 'open');
  const wonDeals = deals.filter((d) => d.status === 'won');
  const totalWonValue = wonDeals.reduce((s, d) => s + (d.value || 0), 0);
  const tabs = [
    { id: 'timeline', label: 'Timeline', count: contact.timeline?.length || 0 },
    { id: 'deals',    label: 'Deals',    count: deals.length },
    { id: 'tasks',    label: 'Tasks',    count: tasks.length },
    { id: 'files',    label: 'Files',    count: contact.attachments?.length || 0 },
  ];

  return (
    <div className="max-w-6xl space-y-4">
      {/* Back nav — sits flush above the hero so the page reads as one block */}
      <button
        onClick={() => navigate('/contacts')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to contacts
      </button>

      {/* Identity hero — name, status and the three primary "do business" actions.
          Edit / Archive moved to small icon buttons in the corner so they stop
          competing with WhatsApp/Call/Email for visual weight. */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-start gap-4 sm:gap-5">
          <Avatar name={fullName} size="lg" className="!w-16 !h-16 !text-lg shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-semibold truncate">{fullName}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {[contact.jobTitle, contact.company].filter(Boolean).join(' · ') || '—'}
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={cn('inline-flex text-xs px-2 py-0.5 rounded-full font-medium capitalize', CONTACT_STATUS_COLORS[contact.status])}>
                    {contact.status}
                  </span>
                  {(contact.tags || []).slice(0, 3).map((t) => (
                    <Badge key={t} variant="secondary">{t}</Badge>
                  ))}
                  {(contact.tags?.length || 0) > 3 && (
                    <span className="text-xs text-muted-foreground">+{contact.tags.length - 3} more</span>
                  )}
                </div>
              </div>

              {/* Management actions — kept compact so the eye lands on the
                  contact actions row below first */}
              {canWrite && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setShowEdit(true)} title="Edit contact">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => setShowDelete(true)} title="Archive contact">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Primary contact actions — these are what reps use 80% of the time */}
            <div className="flex flex-wrap gap-2 mt-4">
              {waUrl && (
                <a href={waUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="success" size="sm"><MessageCircle className="w-4 h-4" /> WhatsApp</Button>
                </a>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone}`}>
                  <Button variant="outline" size="sm"><Phone className="w-4 h-4" /> Call</Button>
                </a>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`}>
                  <Button variant="outline" size="sm"><Mail className="w-4 h-4" /> Email</Button>
                </a>
              )}
              {canUse('ai') ? (
                <Button variant="outline" size="sm" onClick={() => setShowEmailDraft(true)}>
                  <Sparkles className="w-4 h-4 text-primary" /> Draft email
                </Button>
              ) : (
                <UpgradeButton feature="ai" label="Draft email" />
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Quick stats — pulled out of the header so the numbers actually pop. Three
          small tiles, no extra chrome. */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Open deals</p>
          <p className="text-2xl font-semibold mt-1">{openDeals.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Lifetime value</p>
          <p className="text-2xl font-semibold mt-1 truncate">{formatCurrency(totalWonValue, wonDeals[0]?.currency || 'KES')}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Open tasks</p>
          <p className="text-2xl font-semibold mt-1">{openTasks.length}</p>
        </Card>
      </div>

      {/* Two-column body. Left = activity tabs, right = info + AI. Stacks on mobile. */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Tab strip */}
          <div className="flex gap-1 border-b border-border overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap inline-flex items-center gap-1.5',
                  activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
                <span className={cn('text-xs px-1.5 py-0.5 rounded-md font-semibold',
                  activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {activeTab === 'timeline' && (
            <Card className="p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">Activity</h3>
                {canWrite && <Button size="sm" onClick={() => setShowLog(true)}><Plus className="w-4 h-4" /> Log activity</Button>}
              </div>
              {contact.timeline?.length > 0
                ? <div className="space-y-0">{contact.timeline.map((e) => <TimelineEntry key={e._id} entry={e} />)}</div>
                : <EmptyState icon={Clock} title="No activity yet" description="Log a call, note, or email to track interactions" />}
            </Card>
          )}

          {activeTab === 'deals' && (
            <div className="space-y-3">
              {deals.length === 0
                ? <Card className="p-6"><EmptyState icon={FileText} title="No deals" description="Create a deal from the Pipeline page" /></Card>
                : deals.map((deal) => (
                  <Link key={deal._id} to={`/deals/${deal._id}`} className="block">
                    <Card className="p-4 flex items-center justify-between hover:border-primary/40 transition-colors">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{deal.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {deal.stageName} · <span className="font-medium text-foreground">{formatCurrency(deal.value, deal.currency)}</span>
                        </p>
                      </div>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize shrink-0 ml-3', DEAL_STATUS_COLORS[deal.status])}>{deal.status}</span>
                    </Card>
                  </Link>
                ))}
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="space-y-3">
              {tasks.length === 0
                ? <Card className="p-6"><EmptyState icon={Clock} title="No tasks" description="Create tasks from the Tasks page" /></Card>
                : tasks.map((task) => (
                  <Card key={task._id} className="p-4 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{task.type} · Due {formatDate(task.dueDate)}</p>
                    </div>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize shrink-0 ml-3',
                      task.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                      {task.status}
                    </span>
                  </Card>
                ))}
            </div>
          )}

          {activeTab === 'files' && (
            <Card className="p-5 sm:p-6">
              <h3 className="text-sm font-semibold mb-4">Files & attachments</h3>
              <Attachments
                resourceType="contact"
                resourceId={id}
                initialAttachments={contact.attachments || []}
              />
            </Card>
          )}
        </div>

        {/* Right sidebar — facts about the person, plus AI on top */}
        <aside className="space-y-4">
          {/* AI Summary — the single highest-value thing on the page when present.
              Self-framed so the sidebar slot stays one consistent shape. */}
          <AISummaryPanel contact={contact} deals={deals} />

          {/* Contact info */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-4">Contact info</h3>
            <div className="space-y-3.5">
              <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={contact.email} href={contact.email ? `mailto:${contact.email}` : undefined} />
              <InfoRow icon={<Phone className="w-4 h-4" />} label="Phone" value={contact.phone} href={contact.phone ? `tel:${contact.phone}` : undefined} />
              <InfoRow icon={<Building2 className="w-4 h-4" />} label="Company" value={contact.company} />
              <InfoRow icon={<MapPin className="w-4 h-4" />} label="Location" value={[contact.city, contact.country].filter(Boolean).join(', ')} />
              <InfoRow icon={<UserIcon className="w-4 h-4" />} label="Assigned to" value={contact.assignedTo?.name} />
              <InfoRow icon={<Cake className="w-4 h-4" />} label="Birthday" value={contact.birthday ? formatDate(contact.birthday) : null} />
              <InfoRow icon={<Heart className="w-4 h-4" />} label="Anniversary" value={contact.anniversary ? formatDate(contact.anniversary) : null} />
              <InfoRow icon={<CalendarDays className="w-4 h-4" />} label="Added" value={formatDate(contact.createdAt)} />
            </div>
          </Card>

          {/* Notes */}
          {contact.notes && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-2">Notes</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contact.notes}</p>
            </Card>
          )}

          {/* Custom fields — the helper handles its own card + empty-state */}
          <CustomFieldsDisplay contact={contact} fields={customFieldDefs} />
        </aside>
      </div>

      <AddLogModal open={showLog} onClose={() => setShowLog(false)} contactId={id} />
      <EditContactModal open={showEdit} onClose={() => setShowEdit(false)} contact={contact} />
      <EmailDraftModal open={showEmailDraft} onClose={() => setShowEmailDraft(false)} contact={contact} deals={deals} />

      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Archive contact">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to archive <strong>{fullName}</strong>?
            They will be removed from your contacts list. Their deals and tasks will be kept.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
              onClick={() => {
                deleteContact(contact._id);
                navigate('/contacts');
              }}
            >
              Archive contact
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}