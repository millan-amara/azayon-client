import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, MessageCircle, ExternalLink, Sparkles,
  RefreshCw, X, Paperclip, Trophy, XCircle, Edit2,
} from 'lucide-react';
import { useDeal, useMarkDealWon, useMarkDealLost, useUpdateDeal, useTeam } from '@/hooks/useData';
import { useRole } from '@/hooks/useRole';
import { Button, Card, Modal, Input, Select, Textarea, Spinner } from '@/components/ui';
import { Attachments } from '@/components/Attachments';
import { formatCurrency, formatDate, DEAL_STATUS_COLORS, getWhatsAppUrl, cn } from '@/lib/utils';
import { callClaudeStream } from '@/lib/ai';
import toast from 'react-hot-toast';

// ─── AI ASSESSMENT ────────────────────────────────────────────────────────────

function AIDealSummary({ deal, contact }) {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  const generate = async () => {
    setVisible(true);
    setLoading(true);
    setSummary('');

    const stageHistory = (deal.stageHistory || [])
      .map((s) => `${s.stageName} (entered: ${new Date(s.enteredAt).toLocaleDateString()})`)
      .join(' → ');

    try {
      await callClaudeStream({
        systemPrompt: `You are a sales coach reviewing deals in a CRM. Give sharp, concise deal assessments.
Focus on: deal health, risks, momentum, and the single most important next action.
Write 3-4 sentences. Be direct. No fluff. Think like a sales manager.`,
        userPrompt: `Assess this deal for the sales rep:

Deal: ${deal.title}
Value: ${formatCurrency(deal.value, deal.currency)}
Current stage: ${deal.stageName}
Status: ${deal.status}
Expected close: ${deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : 'Not set'}
Lost reason: ${deal.lostReason || 'N/A'}
Stage history: ${stageHistory || 'No history'}
Contact: ${contact ? `${contact.firstName} ${contact.lastName}, ${contact.company || 'unknown company'}` : 'Unknown'}
Notes: ${deal.notes || 'None'}

Give a sharp 3-4 sentence deal assessment: health of the deal, biggest risk, and the #1 next action.`,
        maxTokens: 300,
        onChunk: (_, full) => setSummary(full),
      });
    } catch {
      toast.error('Failed to generate assessment');
      setVisible(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {!visible ? (
        <Button variant="outline" size="sm" onClick={generate}>
          <Sparkles className="w-3.5 h-3.5 text-primary" /> AI Assessment
        </Button>
      ) : (
        <div className="border border-primary/20 rounded-xl bg-primary/5 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">AI Assessment</span>
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
              <Spinner className="w-3 h-3" /> Assessing deal...
            </div>
          ) : (
            <p className="text-sm text-foreground leading-relaxed">{summary}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── EDIT DEAL MODAL ──────────────────────────────────────────────────────────

function EditDealModal({ open, onClose, deal }) {
  const { mutateAsync, isPending } = useUpdateDeal();
  const { data: teamData } = useTeam();
  const [form, setForm] = useState({
    title: deal.title || '',
    value: deal.value || '',
    expectedCloseDate: deal.expectedCloseDate ? formatDate(deal.expectedCloseDate, 'yyyy-MM-dd') : '',
    notes: deal.notes || '',
    assignedTo: deal.assignedTo?._id || '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const updates = { ...form, value: parseFloat(form.value) || 0 };
    if (!updates.assignedTo) delete updates.assignedTo;
    await mutateAsync({ id: deal._id, ...updates });
    onClose();
    toast.success('Deal updated');
  };

  const teamMembers = (teamData?.users || []).filter((u) => u.isActive !== false);

  return (
    <Modal open={open} onClose={onClose} title="Edit deal">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Deal title" value={form.title} onChange={set('title')} required />
        <Input label="Value (KES)" type="number" value={form.value} onChange={set('value')} />
        <Input label="Expected close date" type="date" value={form.expectedCloseDate} onChange={set('expectedCloseDate')} />
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
        <Textarea label="Notes" value={form.notes} onChange={set('notes')} rows={3} />
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isPending}>Save changes</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function DealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useDeal(id);
  const { mutate: markWon } = useMarkDealWon();
  const { mutate: markLost } = useMarkDealLost();
  const { canWrite } = useRole();
  const [showEdit, setShowEdit] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [lostReason, setLostReason] = useState('');

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!data?.deal) return <p className="text-center py-20 text-muted-foreground">Deal not found</p>;

  const deal = data.deal;
  const contact = deal.contact;
  const waUrl = contact?.phone ? getWhatsAppUrl(contact.phone) : null;

  const handleMarkLost = () => {
    markLost({ id: deal._id, reason: lostReason });
    setShowLostModal(false);
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Back */}
      <button onClick={() => navigate('/pipeline')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to pipeline
      </button>

      {/* Header card */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold">{deal.title}</h1>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', DEAL_STATUS_COLORS[deal.status])}>
                {deal.status}
              </span>
            </div>
            <p className="text-3xl font-bold text-primary mt-1">{formatCurrency(deal.value, deal.currency)}</p>
            <p className="text-sm text-muted-foreground mt-1">{deal.stageName} · {deal.pipeline?.name}</p>
          </div>

          {/* Actions */}
          {canWrite && deal.status === 'open' && (
            <div className="flex gap-2 flex-wrap">
              <Button variant="success" size="sm" onClick={() => markWon(deal._id)}>
                <Trophy className="w-4 h-4" /> Mark won
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setShowLostModal(true)}>
                <XCircle className="w-4 h-4" /> Mark lost
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
                <Edit2 className="w-4 h-4" /> Edit
              </Button>
            </div>
          )}
        </div>

        {/* Details grid */}
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border text-sm">
          {[
            { label: 'Assigned to', value: deal.assignedTo?.name },
            { label: 'Expected close', value: deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : '—' },
            { label: 'Probability', value: deal.probability ? `${deal.probability}%` : '—' },
            { label: 'Created', value: formatDate(deal.createdAt) },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-medium mt-0.5">{value || '—'}</p>
            </div>
          ))}
        </div>

        {/* Stage history */}
        {deal.stageHistory?.length > 1 && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Stage history</p>
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              {deal.stageHistory.map((s, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span className="bg-muted px-2 py-0.5 rounded-md">{s.stageName}</span>
                  {i < deal.stageHistory.length - 1 && <span className="text-muted-foreground">→</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {deal.notes && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-1">Notes</p>
            <p className="text-sm text-muted-foreground">{deal.notes}</p>
          </div>
        )}

        {/* Lost reason */}
        {deal.status === 'lost' && deal.lostReason && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-1">Lost reason</p>
            <p className="text-sm text-muted-foreground">{deal.lostReason}</p>
          </div>
        )}

        {/* AI Assessment */}
        <div className="mt-5 pt-4 border-t border-border">
          <AIDealSummary deal={deal} contact={contact} />
        </div>
      </Card>

      {/* Contact card */}
      {contact && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Contact</h3>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
                {(contact.firstName?.[0] || '') + (contact.lastName?.[0] || '')}
              </div>
              <div>
                <p className="font-medium">{contact.firstName} {contact.lastName}</p>
                <p className="text-xs text-muted-foreground">{contact.company || contact.email}</p>
                {contact.phone && <p className="text-xs text-muted-foreground">{contact.phone}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {waUrl && (
                <a href={waUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="success" size="sm"><MessageCircle className="w-4 h-4" /> WhatsApp</Button>
                </a>
              )}
              <Link to={`/contacts/${contact._id}`}>
                <Button variant="outline" size="sm"><ExternalLink className="w-4 h-4" /> View contact</Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Files */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Paperclip className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">
            Files {deal.attachments?.length > 0 && `(${deal.attachments.length})`}
          </h3>
        </div>
        <Attachments
          resourceType="deal"
          resourceId={id}
          initialAttachments={deal.attachments || []}
        />
      </Card>

      {/* Mark lost modal */}
      <Modal open={showLostModal} onClose={() => setShowLostModal(false)} title="Mark deal as lost">
        <div className="space-y-4">
          <Input
            label="Reason (optional)"
            placeholder="e.g. Budget constraints, went with competitor..."
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
          />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowLostModal(false)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={handleMarkLost}>Mark as lost</Button>
          </div>
        </div>
      </Modal>

      {showEdit && <EditDealModal open deal={deal} onClose={() => setShowEdit(false)} />}
    </div>
  );
}