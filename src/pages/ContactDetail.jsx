import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, MessageCircle, Phone, Mail, Edit2,
  Plus, Clock, FileText, PhoneCall, AtSign,
  Sparkles, Copy, Check, RefreshCw, X,
} from 'lucide-react';
import { useContact, useUpdateContact, useAddTimeline } from '@/hooks/useData';
import { useRole } from '@/hooks/useRole';
import {
  Button, Card, Badge, Modal, Input, Select,
  Textarea, Spinner, EmptyState
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

  return (
    <div>
      {!canUse('ai') ? (
        <UpgradeButton feature="ai" label="AI Summary" />
      ) : !visible ? (
        <Button variant="outline" size="sm" onClick={generate}>
          <Sparkles className="w-3.5 h-3.5 text-primary" /> AI Summary
        </Button>
      ) : (
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

function EditContactModal({ open, onClose, contact }) {
  const { mutateAsync, isPending } = useUpdateContact();
  const [form, setForm] = useState({
    firstName: contact.firstName || '', lastName: contact.lastName || '',
    email: contact.email || '', phone: contact.phone || '',
    company: contact.company || '', jobTitle: contact.jobTitle || '',
    status: contact.status || 'lead', notes: contact.notes || '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    await mutateAsync({ id: contact._id, ...form });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit contact">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="First name" value={form.firstName} onChange={set('firstName')} required />
          <Input label="Last name" value={form.lastName} onChange={set('lastName')} />
        </div>
        <Input label="Email" type="email" value={form.email} onChange={set('email')} />
        <Input label="Phone" value={form.phone} onChange={set('phone')} />
        <Input label="Company" value={form.company} onChange={set('company')} />
        <Input label="Job title" value={form.jobTitle} onChange={set('jobTitle')} />
        <Select label="Status" value={form.status} onChange={set('status')}
          options={[{ value: 'lead', label: 'Lead' }, { value: 'prospect', label: 'Prospect' }, { value: 'customer', label: 'Customer' }, { value: 'churned', label: 'Churned' }]} />
        <Textarea label="Notes" value={form.notes} onChange={set('notes')} rows={3} />
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isPending}>Save changes</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useContact(id);
  const { canWrite } = useRole();
  const { canUse } = usePlan();
  const [showLog, setShowLog] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showEmailDraft, setShowEmailDraft] = useState(false);
  const [activeTab, setActiveTab] = useState('timeline');

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!data) return <p className="text-center py-20 text-muted-foreground">Contact not found</p>;

  const { contact, deals = [], tasks = [] } = data;
  const waUrl = getWhatsAppUrl(contact.phone, `Hi ${contact.firstName},`);

  return (
    <div className="max-w-4xl space-y-6">
      <button onClick={() => navigate('/contacts')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to contacts
      </button>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
              {(contact.firstName?.[0] || '') + (contact.lastName?.[0] || '')}
            </div>
            <div>
              <h2 className="text-xl font-semibold">{contact.firstName} {contact.lastName}</h2>
              {contact.jobTitle && <p className="text-sm text-muted-foreground">{contact.jobTitle}</p>}
              {contact.company && <p className="text-sm text-muted-foreground">{contact.company}</p>}
              <span className={cn('mt-2 inline-flex text-xs px-2 py-0.5 rounded-full font-medium capitalize', CONTACT_STATUS_COLORS[contact.status])}>
                {contact.status}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {waUrl && (
              <a href={waUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="success" size="sm"><MessageCircle className="w-4 h-4" /> WhatsApp</Button>
              </a>
            )}
            {contact.phone && <a href={`tel:${contact.phone}`}><Button variant="outline" size="sm"><Phone className="w-4 h-4" /> Call</Button></a>}
            {contact.email && <a href={`mailto:${contact.email}`}><Button variant="outline" size="sm"><Mail className="w-4 h-4" /> Email</Button></a>}
            {canUse('ai') ? (
              <Button variant="outline" size="sm" onClick={() => setShowEmailDraft(true)}>
                <Sparkles className="w-4 h-4 text-primary" /> Draft email
              </Button>
            ) : (
              <UpgradeButton feature="ai" label="Draft email" />
            )}
            {canWrite && (
              <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
                <Edit2 className="w-4 h-4" /> Edit
              </Button>
            )}
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-border">
          <AISummaryPanel contact={contact} deals={deals} />
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
          {[{ label: 'Email', value: contact.email }, { label: 'Phone', value: contact.phone }, { label: 'Country', value: contact.country }, { label: 'Added', value: formatDate(contact.createdAt) }]
            .map(({ label, value }) => value && (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium mt-0.5 truncate">{value}</p>
              </div>
            ))}
        </div>
        {contact.notes && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-1">Notes</p>
            <p className="text-sm text-muted-foreground">{contact.notes}</p>
          </div>
        )}
      </Card>

      <div className="flex gap-1 border-b border-border">
        {[{ id: 'timeline', label: `Timeline (${contact.timeline?.length || 0})` }, { id: 'deals', label: `Deals (${deals.length})` }, { id: 'tasks', label: `Tasks (${tasks.length})` }, { id: 'files', label: `Files (${contact.attachments?.length || 0})` }]
          .map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}>
              {tab.label}
            </button>
          ))}
      </div>

      {activeTab === 'timeline' && (
        <Card className="p-6">
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
          {deals.length === 0 ? <Card className="p-6"><EmptyState icon={FileText} title="No deals" description="Create a deal from the Pipeline page" /></Card>
            : deals.map((deal) => (
              <Card key={deal._id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{deal.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{deal.stageName} · {formatCurrency(deal.value, deal.currency)}</p>
                </div>
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', DEAL_STATUS_COLORS[deal.status])}>{deal.status}</span>
              </Card>
            ))}
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="space-y-3">
          {tasks.length === 0 ? <Card className="p-6"><EmptyState icon={Clock} title="No tasks" description="Create tasks from the Tasks page" /></Card>
            : tasks.map((task) => (
              <Card key={task._id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{task.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{task.type} · Due {formatDate(task.dueDate)}</p>
                </div>
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', task.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                  {task.status}
                </span>
              </Card>
            ))}
        </div>
      )}

      {activeTab === 'files' && (
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4">Files & attachments</h3>
          <Attachments
            resourceType="contact"
            resourceId={id}
            initialAttachments={contact.attachments || []}
          />
        </Card>
      )}

      <AddLogModal open={showLog} onClose={() => setShowLog(false)} contactId={id} />
      <EditContactModal open={showEdit} onClose={() => setShowEdit(false)} contact={contact} />
      <EmailDraftModal open={showEmailDraft} onClose={() => setShowEmailDraft(false)} contact={contact} deals={deals} />
    </div>
  );
}