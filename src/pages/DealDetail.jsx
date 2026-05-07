import { useState, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, MessageCircle, ExternalLink, Sparkles,
  RefreshCw, X, Paperclip, Trophy, XCircle, Edit2, Trash2,
  Calendar, Percent, User as UserIcon, Clock,
  Phone, Mail, MessageSquare, Send,
  CheckSquare, Square, ListTodo,
} from 'lucide-react';
import {
  useDeal, useMarkDealWon, useMarkDealLost, useUpdateDeal, useTeam, useDeleteDeal,
  useCustomFields, useAddDealComment, useDeleteDealComment,
  useTasks, useCreateTask, useUpdateTask, useDeleteTask,
} from '@/hooks/useData';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/hooks/useRole';
import { Button, Card, Modal, Input, Select, Textarea, Spinner, Avatar } from '@/components/ui';
import { Attachments } from '@/components/Attachments';
import { formatCurrency, formatDate, timeAgo, dueDateLabel, DEAL_STATUS_COLORS, getWhatsAppUrl, cn } from '@/lib/utils';
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

  // Both states share the same outer shape so the sidebar slot doesn't change
  // size when the rep clicks "AI Assessment".
  if (!visible) {
    return (
      <button
        onClick={generate}
        className="w-full text-left border border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 rounded-xl p-4 transition-colors"
      >
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-primary">AI Assessment</p>
        </div>
        <p className="text-xs text-muted-foreground">Get a coach-style read on this deal's health and the next move.</p>
      </button>
    );
  }

  return (
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
  );
}

// ─── EDIT DEAL MODAL ──────────────────────────────────────────────────────────

// Mongo Maps serialize as plain objects on the wire — normalize either form.
function readCustomFields(deal) {
  const cf = deal?.customFields;
  if (!cf) return {};
  if (cf instanceof Map) return Object.fromEntries(cf);
  return { ...cf };
}

function EditDealModal({ open, onClose, deal }) {
  const { mutateAsync, isPending } = useUpdateDeal();
  const { data: teamData } = useTeam();
  const { data: customFieldsData } = useCustomFields('deal');
  const customFields = customFieldsData?.fields || [];
  const [form, setForm] = useState({
    title: deal.title || '',
    value: deal.value || '',
    expectedCloseDate: deal.expectedCloseDate ? formatDate(deal.expectedCloseDate, 'yyyy-MM-dd') : '',
    notes: deal.notes || '',
    assignedTo: deal.assignedTo?._id || '',
  });
  const [customValues, setCustomValues] = useState(() => readCustomFields(deal));
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
    const updates = { ...form, value: parseFloat(form.value) || 0 };
    if (!updates.assignedTo) delete updates.assignedTo;
    if (customFields.length > 0) updates.customFields = customValues;
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

        {customFields.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Additional info</p>
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

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isPending}>Save changes</Button>
        </div>
      </form>
    </Modal>
  );
}

// Read-only block that shows custom field values. Self-frames so the sidebar
// doesn't end up with an empty card when no fields are set.
function DealCustomFieldsDisplay({ deal, fields }) {
  const values = readCustomFields(deal);
  const populated = fields.filter((f) => values[f.key] != null && values[f.key] !== '');
  if (populated.length === 0) return null;

  const formatValue = (f, raw) => {
    if (f.type === 'date')   { try { return formatDate(raw); } catch { return raw; } }
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

// Sidebar info-row with icon. Skips itself for empty values. `icon` is
// rendered JSX (e.g. `<Calendar className="..." />`), passed by the caller.
function InfoRow({ icon, label, value }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex items-start gap-3">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

// Visual stage progress bar. Shows the open stages (Won/Lost are end states,
// not steps). Active stage gets a filled chip; stages the deal has already
// passed get a muted-success fill; future stages stay neutral.
//
// When the deal is in a Won stage we render the full row in success colour;
// in a Lost stage we render it in destructive colour to make the outcome
// scannable at a glance.
function StageProgress({ stages = [], currentStageId, status }) {
  if (!stages || stages.length === 0) return null;

  // Index open stages in pipeline order so we can mark "passed" stages.
  const openStages = [...stages].filter((s) => !s.isWon && !s.isLost).sort((a, b) => a.order - b.order);
  const currentIdx = openStages.findIndex((s) => s._id?.toString() === currentStageId?.toString());
  const isWon = status === 'won';
  const isLost = status === 'lost';

  return (
    <div className="flex items-stretch gap-1 overflow-x-auto -mx-1 px-1">
      {openStages.map((s, i) => {
        const passed = currentIdx >= 0 && i < currentIdx;
        const active = currentIdx >= 0 && i === currentIdx;
        const cls = isWon
          ? 'bg-green-100 text-green-700 border-green-200'
          : isLost
            ? 'bg-red-50 text-red-500 border-red-100'
            : active
              ? 'bg-primary text-primary-foreground border-primary'
              : passed
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'bg-muted text-muted-foreground border-border';
        return (
          <div
            key={s._id}
            className={cn(
              'flex-1 min-w-18 px-2 py-1.5 rounded-md border text-xs font-medium text-center truncate',
              cls
            )}
            title={s.name}
          >
            {s.name}
          </div>
        );
      })}
      {/* End-state pill */}
      {(isWon || isLost) && (
        <div className={cn(
          'shrink-0 px-2 py-1.5 rounded-md text-xs font-semibold border flex items-center gap-1',
          isWon ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600'
        )}>
          {isWon ? <Trophy className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
          {isWon ? 'Won' : 'Lost'}
        </div>
      )}
    </div>
  );
}

// Vertical stage history showing how the deal has moved through the pipeline.
// Most recent first, with a connector line so it reads as a journey.
function StageHistoryTimeline({ history = [] }) {
  if (!history || history.length === 0) return null;
  // Render newest first
  const sorted = [...history].sort((a, b) => new Date(b.enteredAt) - new Date(a.enteredAt));
  return (
    <ol className="relative pl-5">
      <span className="absolute left-1.75 top-2 bottom-2 w-px bg-border" aria-hidden />
      {sorted.map((s, i) => (
        <li key={i} className="relative pb-4 last:pb-0">
          <span className={cn(
            'absolute -left-5 top-1.5 w-3 h-3 rounded-full border-2 border-background',
            i === 0 ? 'bg-primary' : 'bg-muted-foreground/40'
          )} />
          <p className="text-sm font-medium">{s.stageName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Entered {timeAgo(s.enteredAt)}
            {s.exitedAt && <> · Stayed {Math.max(1, Math.round((new Date(s.exitedAt) - new Date(s.enteredAt)) / 86400000))} day{Math.round((new Date(s.exitedAt) - new Date(s.enteredAt)) / 86400000) === 1 ? '' : 's'}</>}
          </p>
        </li>
      ))}
    </ol>
  );
}

// ─── COMMENTS ────────────────────────────────────────────────────────────────

// Render plain text with @mentions visually highlighted. React escapes by
// default — we never use dangerouslySetInnerHTML — so this is safe even when
// a comment contains `<script>` or HTML-like input.
function renderCommentBody(body) {
  const parts = (body || '').split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@') && part.length > 1) {
      return <span key={i} className="text-primary font-medium bg-primary/5 rounded px-0.5">{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

function CommentsSection({ deal, comments }) {
  const { user } = useAuth();
  const { canWrite } = useRole();
  const { data: teamData } = useTeam();
  const teamMembers = useMemo(
    () => (teamData?.users || []).filter((u) => u.isActive !== false),
    [teamData]
  );
  const { mutateAsync: addComment, isPending: posting } = useAddDealComment();
  const { mutate: deleteComment } = useDeleteDealComment();

  const [text, setText] = useState('');
  // Track who the user has mentioned in *this* draft so we can attach the right
  // userIds when they submit. Cleared after post.
  const [mentionedIds, setMentionedIds] = useState(() => new Set());
  // {text, startIndex} when the cursor is sitting in an unfinished `@…` token.
  const [mentionQuery, setMentionQuery] = useState(null);
  const textareaRef = useRef(null);

  // Filter team members for the mention popover. Excludes self — pinging
  // yourself is just noise.
  const candidates = useMemo(() => {
    if (!mentionQuery) return [];
    const q = mentionQuery.text.toLowerCase();
    return teamMembers
      .filter((u) => String(u._id) !== String(user._id))
      .filter((u) => !q || (u.name || '').toLowerCase().includes(q))
      .slice(0, 5);
  }, [mentionQuery, teamMembers, user._id]);

  const handleChange = (e) => {
    const value = e.target.value;
    setText(value);

    // Detect cursor inside an unfinished @mention. We only show the popover
    // when the @ is fresh (still being typed) — once the user types a space,
    // the regex stops matching and the popover hides.
    const cursor = e.target.selectionStart;
    const beforeCursor = value.slice(0, cursor);
    const match = beforeCursor.match(/@([\w]*)$/);
    if (match) {
      setMentionQuery({ text: match[1], startIndex: cursor - match[0].length });
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (u) => {
    // Use first name only — the popover already disambiguates multi-word names.
    const handle = (u.name || '').split(/\s+/)[0];
    const before = text.slice(0, mentionQuery.startIndex);
    const after = text.slice(mentionQuery.startIndex + 1 + mentionQuery.text.length);
    const insert = `@${handle} `;
    const newText = `${before}${insert}${after}`;
    setText(newText);
    setMentionedIds((s) => new Set(s).add(String(u._id)));
    setMentionQuery(null);
    // Restore caret position after the inserted mention so typing continues
    // naturally without a flash of cursor-at-end.
    requestAnimationFrame(() => {
      const pos = before.length + insert.length;
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(pos, pos);
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;

    // Filter mentionedIds to those whose @handle still appears in the final
    // text — if the user typed @Jane then deleted it, Jane shouldn't get pinged.
    const lower = body.toLowerCase();
    const stillMentioned = [...mentionedIds].filter((id) => {
      const u = teamMembers.find((t) => String(t._id) === id);
      if (!u) return false;
      const handle = (u.name || '').split(/\s+/)[0].toLowerCase();
      return !!handle && lower.includes('@' + handle);
    });

    try {
      await addComment({ dealId: deal._id, body, mentions: stillMentioned });
      setText('');
      setMentionedIds(new Set());
    } catch {
      // Error toast is handled by the mutation hook
    }
  };

  const handleDelete = (commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    deleteComment({ dealId: deal._id, commentId });
  };

  // Newest first — matches the contact timeline pattern users already know.
  const sorted = [...(comments || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">
          Comments
          {sorted.length > 0 && <span className="text-muted-foreground font-normal"> · {sorted.length}</span>}
        </h3>
      </div>

      {/* Composer — hidden for viewers */}
      {canWrite && (
        <form onSubmit={handleSubmit} className="space-y-2 mb-5">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleChange}
              placeholder="Leave context for the team. Type @ to mention a teammate."
              rows={3}
              maxLength={2000}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />

            {/* Mention popover. Anchored beneath the textarea — small enough
                to not need portal-positioning logic. */}
            {mentionQuery && candidates.length > 0 && (
              <div className="absolute z-10 left-0 sm:w-72 mt-1 bg-background border border-border rounded-lg shadow-lg overflow-hidden">
                {candidates.map((u) => (
                  <button
                    key={u._id}
                    type="button"
                    onClick={() => insertMention(u)}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-muted transition-colors"
                  >
                    <Avatar name={u.name} size="xs" />
                    <span className="text-sm truncate">{u.name}</span>
                    {u.role && (
                      <span className="ml-auto text-xs text-muted-foreground">{u.role.replace('_', ' ')}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {text.length > 0 ? `${text.length}/2000` : 'Tip: @name to notify a teammate'}
            </p>
            <Button type="submit" size="sm" loading={posting} disabled={!text.trim()}>
              <Send className="w-3.5 h-3.5" /> Post
            </Button>
          </div>
        </form>
      )}

      {/* Comment list */}
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No comments yet.{canWrite ? ' Drop a note for your team.' : ''}
        </p>
      ) : (
        <ul className="space-y-4">
          {sorted.map((c) => {
            const isMine = String(c.createdBy?._id) === String(user._id);
            const canDelete = canWrite && (isMine || user.role === 'admin');
            return (
              <li key={c._id} className="flex gap-3">
                <Avatar name={c.createdBy?.name} src={c.createdBy?.avatar} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-medium truncate">{c.createdBy?.name || 'Someone'}</p>
                    <p className="text-xs text-muted-foreground shrink-0">{timeAgo(c.createdAt)}</p>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(c._id)}
                        className="ml-auto p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete comment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed mt-0.5">
                    {renderCommentBody(c.body)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ─── TASKS ON THIS DEAL ───────────────────────────────────────────────────────
// Inline list + quick-add. Reuses the existing Task model, which already has a
// `deal` ref and an index on it — so tasks created here also show up on the
// global /tasks page, and (because we link the deal's contact too) on the
// linked contact's page. Full editing (recurrence, reminders, type, priority)
// stays on the main /tasks page; this section is just for fast capture and
// completion in the deal context.
function DealTasksSection({ dealId, contactId }) {
  const { user } = useAuth();
  const { data, isLoading } = useTasks({ dealId, limit: 100 });
  const tasks = data?.tasks || [];
  const open = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
  const done = tasks.filter((t) => t.status === 'completed');

  const [showDone, setShowDone] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const create = useCreateTask();
  const update = useUpdateTask();
  const remove = useDeleteTask();

  const handleAdd = async (e) => {
    e.preventDefault();
    const title = quickTitle.trim();
    if (!title) return;
    setQuickTitle('');
    await create.mutateAsync({
      title,
      deal: dealId,
      contact: contactId,
      assignedTo: user._id,
      type: 'follow_up',
      priority: 'medium',
    });
  };

  const toggle = (task) => {
    update.mutate({
      id: task._id,
      status: task.status === 'completed' ? 'pending' : 'completed',
    });
  };

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-3">
        <ListTodo className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">
          Tasks
          {open.length > 0 && (
            <span className="text-muted-foreground font-normal"> · {open.length} open</span>
          )}
        </h3>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2 mb-3">
        <div className="flex-1">
          <Input
            placeholder="Add a task and press Enter…"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
          />
        </div>
        <Button type="submit" size="sm" disabled={!quickTitle.trim() || create.isPending}>
          Add
        </Button>
      </form>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : open.length > 0 ? (
        <ul className="-mx-2">
          {open.map((t) => (
            <DealTaskRow key={t._id} task={t} onToggle={() => toggle(t)} onDelete={() => remove.mutate(t._id)} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No open tasks.</p>
      )}

      {done.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowDone((s) => !s)}
            className="text-xs text-muted-foreground hover:text-foreground mt-3"
          >
            {showDone ? 'Hide' : 'Show'} {done.length} completed
          </button>
          {showDone && (
            <ul className="-mx-2 mt-2">
              {done.map((t) => (
                <DealTaskRow key={t._id} task={t} onToggle={() => toggle(t)} onDelete={() => remove.mutate(t._id)} />
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

function DealTaskRow({ task, onToggle, onDelete }) {
  const isDone = task.status === 'completed';
  const due = dueDateLabel(task.dueDate);
  return (
    <li className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/40">
      <button
        type="button"
        onClick={onToggle}
        className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
        aria-label={isDone ? 'Mark as not done' : 'Mark complete'}
      >
        {isDone
          ? <CheckSquare className="w-4 h-4 text-green-600" />
          : <Square className="w-4 h-4" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm truncate', isDone && 'line-through text-muted-foreground')}>
          {task.title}
        </p>
        {(due || task.assignedTo) && (
          <p className="text-xs text-muted-foreground truncate">
            {due && <span className={due.color}>{due.label}</span>}
            {due && task.assignedTo && <span> · </span>}
            {task.assignedTo && <span>{task.assignedTo.name}</span>}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity shrink-0"
        title="Delete task"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </li>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function DealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useDeal(id);
  const { data: customFieldsData } = useCustomFields('deal');
  const customFieldDefs = customFieldsData?.fields || [];
  const { mutate: markWon } = useMarkDealWon();
  const { mutate: markLost } = useMarkDealLost();
  const { mutate: deleteDeal } = useDeleteDeal();
  const { canWrite } = useRole();
  const [showEdit, setShowEdit] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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

  const isOpen = deal.status === 'open';
  const stageColor = isOpen ? 'text-primary' : deal.status === 'won' ? 'text-green-600' : 'text-red-500';

  return (
    <div className="max-w-6xl space-y-4">
      {/* Back nav */}
      <button
        onClick={() => navigate('/pipeline')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to pipeline
      </button>

      {/* Hero card — value is the headline, stage progress is the second-most
          scannable element. Edit/Delete pushed into icon buttons so the eye
          lands on Mark Won / Mark Lost first. */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-semibold truncate">{deal.title}</h1>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize shrink-0', DEAL_STATUS_COLORS[deal.status])}>
                {deal.status}
              </span>
            </div>
            <p className={cn('text-3xl sm:text-4xl font-bold mt-2', stageColor)}>
              {formatCurrency(deal.value, deal.currency)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-medium text-foreground">{deal.stageName}</span>
              {deal.pipeline?.name && <> · {deal.pipeline.name}</>}
            </p>
          </div>

          {/* Actions — primary verbs first, management actions as icons */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {canWrite && isOpen && (
              <>
                <Button variant="success" size="sm" onClick={() => markWon(deal._id)}>
                  <Trophy className="w-4 h-4" /> Mark won
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setShowLostModal(true)}>
                  <XCircle className="w-4 h-4" /> Mark lost
                </Button>
              </>
            )}
            {canWrite && (
              <div className="flex items-center gap-1">
                {isOpen && (
                  <Button variant="ghost" size="icon" onClick={() => setShowEdit(true)} title="Edit deal">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-500 hover:bg-red-50"
                  onClick={() => setShowDeleteModal(true)}
                  title="Delete deal"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Stage progress — visual, not just an arrow string */}
        {deal.pipeline?.stages?.length > 0 && (
          <div className="mt-5 pt-4 border-t border-border">
            <StageProgress
              stages={deal.pipeline.stages}
              currentStageId={deal.stageId}
              status={deal.status}
            />
          </div>
        )}
      </Card>

      {/* Two-column body. Stacks on mobile. */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Notes */}
          {deal.notes && (
            <Card className="p-5 sm:p-6">
              <h3 className="text-sm font-semibold mb-2">Notes</h3>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{deal.notes}</p>
            </Card>
          )}

          {/* Tasks for this deal */}
          <DealTasksSection dealId={id} contactId={contact?._id} />

          {/* Lost reason — surface it loudly so reps don't miss the post-mortem */}
          {deal.status === 'lost' && deal.lostReason && (
            <Card className="p-5 sm:p-6 border-red-200 bg-red-50/40">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-4 h-4 text-red-500" />
                <h3 className="text-sm font-semibold text-red-700">Lost reason</h3>
              </div>
              <p className="text-sm text-red-900 whitespace-pre-wrap">{deal.lostReason}</p>
            </Card>
          )}

          {/* Stage history — shown as a vertical journey, only when there's
              more than the initial entry (otherwise it's just one chip) */}
          {deal.stageHistory?.length > 1 && (
            <Card className="p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Stage history</h3>
              </div>
              <StageHistoryTimeline history={deal.stageHistory} />
            </Card>
          )}

          {/* Comments — internal team thread on this deal */}
          <CommentsSection deal={deal} comments={deal.comments} />

          {/* Files */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Paperclip className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">
                Files{deal.attachments?.length > 0 && <span className="text-muted-foreground font-normal"> · {deal.attachments.length}</span>}
              </h3>
            </div>
            <Attachments
              resourceType="deal"
              resourceId={id}
              initialAttachments={deal.attachments || []}
            />
          </Card>
        </div>

        {/* Right sidebar — facts about the deal + the contact + AI on top */}
        <aside className="space-y-4">
          {/* AI Assessment */}
          <AIDealSummary deal={deal} contact={contact} />

          {/* Deal info */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-4">Deal info</h3>
            <div className="space-y-3.5">
              <InfoRow icon={<UserIcon className="w-4 h-4" />} label="Assigned to" value={deal.assignedTo?.name} />
              <InfoRow icon={<Calendar className="w-4 h-4" />} label="Expected close" value={deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : null} />
              <InfoRow icon={<Percent className="w-4 h-4" />} label="Probability" value={deal.probability != null ? `${deal.probability}%` : null} />
              <InfoRow icon={<Clock className="w-4 h-4" />} label="Created" value={formatDate(deal.createdAt)} />
              {deal.closedAt && (
                <InfoRow
                  icon={deal.status === 'won' ? <Trophy className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-500" />}
                  label={deal.status === 'won' ? 'Won on' : deal.status === 'lost' ? 'Lost on' : 'Closed on'}
                  value={formatDate(deal.closedAt)}
                />
              )}
            </div>
          </Card>

          {/* Contact card — compact, with quick actions */}
          {contact && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-3">Contact</h3>
              <div className="flex items-start gap-3">
                <Avatar name={`${contact.firstName || ''} ${contact.lastName || ''}`} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{contact.firstName} {contact.lastName}</p>
                  {contact.company && <p className="text-xs text-muted-foreground truncate">{contact.company}</p>}
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className="text-xs text-muted-foreground hover:text-primary truncate block mt-1">{contact.email}</a>
                  )}
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} className="text-xs text-muted-foreground hover:text-primary truncate block">{contact.phone}</a>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {waUrl && (
                  <a href={waUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button variant="success" size="sm" className="w-full"><MessageCircle className="w-4 h-4" /> WhatsApp</Button>
                  </a>
                )}
                {contact.phone && (
                  <a href={`tel:${contact.phone}`}>
                    <Button variant="outline" size="sm"><Phone className="w-4 h-4" /></Button>
                  </a>
                )}
                {contact.email && (
                  <a href={`mailto:${contact.email}`}>
                    <Button variant="outline" size="sm"><Mail className="w-4 h-4" /></Button>
                  </a>
                )}
                <Link to={`/contacts/${contact._id}`}>
                  <Button variant="outline" size="sm"><ExternalLink className="w-4 h-4" /></Button>
                </Link>
              </div>
            </Card>
          )}

          {/* Custom fields — self-frames; renders nothing when empty */}
          <DealCustomFieldsDisplay deal={deal} fields={customFieldDefs} />
        </aside>
      </div>

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

      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete deal">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deal.title}</strong>?
            This cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
              onClick={() => {
                deleteDeal(deal._id);
                navigate('/pipeline');
              }}
            >
              Delete deal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}