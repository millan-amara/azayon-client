import { useState } from 'react';
import {
  Zap, Plus, ToggleLeft, ToggleRight, Trash2, Play, Clock,
  ChevronDown, AlertCircle, CheckCircle2, Brain, Search, Rocket, Pencil, XCircle,
} from 'lucide-react';
import {
  useAutomations, useAutomationTemplates,
  useCreateAutomation, useUpdateAutomation, useToggleAutomation, useDeleteAutomation,
  useTestAutomation, useTeam, usePipelines,
} from '@/hooks/useData';
import { useRole } from '@/hooks/useRole';
import { usePlan } from '@/context/PlanContext';
import { LockedFeature, UpgradeButton } from '@/components/Upgrade';
import { Button, Card, Badge, Modal, Input, Select, Textarea, Spinner, EmptyState } from '@/components/ui';
import { timeAgo, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const TRIGGER_LABELS = {
  'deal.stage_changed': '🚀 Deal moves to a new stage',
  'deal.created': '✨ New deal is created',
  'deal.won': '🏆 Deal is marked as won',
  'deal.lost': '💔 Deal is marked as lost',
  'contact.created': '👤 New contact is added',
  'task.overdue': '⏰ Task becomes overdue',
  'deal.inactive': '❄️ Deal goes cold (no activity)',
};

const ACTION_LABELS = {
  send_email: '✉️ Send an email',
  send_webhook: '🔗 Send to n8n / webhook',
  send_whatsapp: '💬 Send WhatsApp message',
  create_task: '✅ Create follow-up task',
  create_deal: '💼 Open new deal',
  assign_to_user: '👤 Assign to team member',
  add_tag: '🏷️ Add tag to contact',
  update_deal_stage: '📋 Move deal to stage',
};

const WHATSAPP_TEMPLATES = [
  { value: 'deal_inactive',  label: 'Deal cold ping (uses {{deal.title}})' },
  { value: 'deal_assigned',  label: 'Deal assigned (uses {{deal.title}})' },
  { value: 'task_reminder',  label: 'Task reminder (uses {{task.title}}, due date)' },
  { value: 'task_assigned',  label: 'Task assigned (uses {{task.title}}, due date)' },
];

// ─── TEMPLATE CARD ────────────────────────────────────────────────────────────

function TemplateCard({ template, activeTemplateIds, onActivate }) {
  const { canWrite } = useRole();
  const isActive = activeTemplateIds?.includes(template.id);

  return (
    <div className={cn(
      'relative border rounded-xl p-4 transition-all',
      isActive ? 'border-primary/30 bg-primary/5' : 'border-border bg-card hover:border-primary/40 hover:shadow-sm'
    )}>
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
      )}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl shrink-0">
          {template.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold">{template.name}</p>
                {isActive && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
              <div className="flex flex-col gap-1 mt-2">
                <div className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 w-12">When:</span>
                  <span className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded-md">
                    {TRIGGER_LABELS[template.trigger.type]}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 w-12">Then:</span>
                  <div className="flex gap-1 flex-wrap">
                    {template.actions.map((a, i) => (
                      <span key={i} className="bg-muted text-muted-foreground px-2 py-0.5 rounded-md border border-border">
                        {ACTION_LABELS[a.type]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {canWrite && (
              <Button
                size="sm"
                variant={isActive ? 'outline' : 'default'}
                onClick={() => onActivate(template)}
                className="shrink-0 self-start mt-0.5"
              >
                {isActive ? 'Add another' : 'Use'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ACTIVATE TEMPLATE MODAL ──────────────────────────────────────────────────

// Caller passes `key={template?.id || 'none'}` so this remounts with a fresh
// config/step whenever a different template is chosen.
function ActivateTemplateModal({ open, onClose, onSuccess, template, hasDuplicate }) {
  const { mutateAsync, isPending } = useCreateAutomation();
  const { data: teamData } = useTeam();
  const { data: pipelinesData } = usePipelines();
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState(() => ({
    name: template?.name || '',
    webhookUrl: '',
    assignUserId: '',
    pipelineId: '',
    stageId: '',
    triggerStageId: '',
    confirmedDuplicate: false,
  }));

  if (!template) return null;

  const needsWebhook = template.actions.some((a) => a.type === 'send_webhook');
  const needsAssignUser = template.actions.some((a) => a.type === 'assign_to_user');
  const needsDealConfig = template.actions.some((a) => a.type === 'create_deal');
  const needsStageFilter = template.trigger.type === 'deal.stage_changed' && template.id === 'proposal_task';
  const needsExtraConfig = needsWebhook || needsAssignUser || needsDealConfig || needsStageFilter;
  const showDuplicateWarning = hasDuplicate && !config.confirmedDuplicate;

  const users = (teamData?.users || []).filter((u) => u.isActive !== false);
  const pipelines = pipelinesData?.pipelines || [];
  const selectedPipeline = pipelines.find((p) => p._id === config.pipelineId);

  const isValid = () => {
    if (!config.name) return false;
    if (needsWebhook && !config.webhookUrl) return false;
    if (needsAssignUser && !config.assignUserId) return false;
    if (needsDealConfig && (!config.pipelineId || !config.stageId)) return false;
    if (needsStageFilter && (!config.pipelineId || !config.triggerStageId)) return false;
    return true;
  };

  const handleActivate = async () => {
    const actions = template.actions.map((a) => {
      if (a.type === 'send_webhook') return { ...a, config: { ...a.config, url: config.webhookUrl } };
      if (a.type === 'assign_to_user') return { ...a, config: { ...a.config, userId: config.assignUserId } };
      if (a.type === 'create_deal') return { ...a, config: { ...a.config, pipelineId: config.pipelineId, stageId: config.stageId } };
      return a;
    });

    // For stage filter templates, add a condition on stageName
    let conditions = template.conditions || [];
    if (needsStageFilter && config.triggerStageId && selectedPipeline) {
      const stage = selectedPipeline.stages.find((s) => s._id === config.triggerStageId);
      if (stage) {
        conditions = [{ field: 'deal.stageName', operator: 'equals', value: stage.name }];
      }
    }

    await mutateAsync({ templateId: template.id, name: config.name, actions, conditions });
    onSuccess();
  };

  // Steps: 1 = review/duplicate check, 2 = configure (only if needed)
  const totalSteps = needsExtraConfig ? 2 : 1;

  return (
    <Modal open={open} onClose={onClose} title="Activate automation">
      <div className="space-y-4">
        {/* Step indicator - only show if 2 steps */}
        {totalSteps === 2 && (
          <div className="flex items-center gap-2">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
                  s === step ? 'bg-primary text-primary-foreground' :
                  s < step ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                )}>
                  {s < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : s}
                </div>
                {s === 1 && <div className={cn('flex-1 h-0.5 mx-2', step > 1 ? 'bg-primary' : 'bg-muted')} />}
              </div>
            ))}
          </div>
        )}

        {/* Duplicate warning (shown on step 1 if applicable) */}
        {showDuplicateWarning && step === 1 ? (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 mb-1">You already have a similar automation running</p>
                  <p className="text-xs text-amber-700">An active automation with the same trigger exists. Both will fire at the same time, which may cause duplicate tasks or emails.</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button variant="secondary" className="flex-1" onClick={() => setConfig(c => ({ ...c, confirmedDuplicate: true }))}>
                Add anyway
              </Button>
            </div>
          </>
        ) : step === 1 ? (
          // Step 1: Review
          <>
            <div className="bg-muted/40 rounded-xl p-4 border border-border space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{template.icon}</span>
                <div>
                  <p className="font-medium">{template.name}</p>
                  <p className="text-xs text-muted-foreground">{template.description}</p>
                </div>
              </div>
              <div className="space-y-2 pt-1 border-t border-border">
                <div className="flex items-start gap-2 text-sm">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Zap className="w-3 h-3 text-blue-600" />
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">When: </span>
                    <span className="text-xs">{TRIGGER_LABELS[template.trigger.type]}</span>
                  </div>
                </div>
                {template.actions.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <Rocket className="w-3 h-3 text-green-600" />
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Then: </span>
                      <span className="text-xs">{ACTION_LABELS[a.type]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button className="flex-1" onClick={() => needsExtraConfig ? setStep(2) : handleActivate()} loading={!needsExtraConfig && isPending}>
                {needsExtraConfig ? 'Continue' : 'Activate'}
              </Button>
            </div>
          </>
        ) : (
          // Step 2: Configure
          <>
            <Input label="Automation name *" value={config.name} onChange={(e) => setConfig(c => ({ ...c, name: e.target.value }))} />

            {needsWebhook && (
              <div className="space-y-1.5">
                <Input
                  label="n8n webhook URL *"
                  placeholder="https://your-n8n.com/webhook/..."
                  value={config.webhookUrl}
                  onChange={(e) => setConfig(c => ({ ...c, webhookUrl: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Add a Webhook node in n8n and paste the URL here. The CRM sends the full context.</p>
              </div>
            )}

            {needsAssignUser && (
              <Select
                label="Assign new leads to *"
                value={config.assignUserId}
                onChange={(e) => setConfig(c => ({ ...c, assignUserId: e.target.value }))}
                options={[{ value: '', label: 'Select team member...' }, ...users.map((u) => ({ value: u._id, label: u.name }))]}
              />
            )}

            {needsDealConfig && (
              <>
                <Select
                  label="Pipeline *"
                  value={config.pipelineId}
                  onChange={(e) => setConfig(c => ({ ...c, pipelineId: e.target.value, stageId: '' }))}
                  options={[{ value: '', label: 'Select pipeline...' }, ...(pipelinesData?.pipelines || []).map((p) => ({ value: p._id, label: p.name }))]}
                />
                <RestrictedPipelineNotice pipeline={selectedPipeline} action="create_deal" />
                {selectedPipeline && (
                  <Select
                    label="Starting stage *"
                    value={config.stageId}
                    onChange={(e) => setConfig(c => ({ ...c, stageId: e.target.value }))}
                    options={[
                      { value: '', label: 'Select stage...' },
                      ...selectedPipeline.stages.filter((s) => !s.isWon && !s.isLost).map((s) => ({ value: s._id, label: s.name })),
                    ]}
                  />
                )}
              </>
            )}

            {needsStageFilter && (
              <>
                <Select
                  label="Which pipeline? *"
                  value={config.pipelineId}
                  onChange={(e) => setConfig(c => ({ ...c, pipelineId: e.target.value, triggerStageId: '' }))}
                  options={[{ value: '', label: 'Select pipeline...' }, ...pipelines.map((p) => ({ value: p._id, label: p.name }))]}
                />
                {selectedPipeline && (
                  <Select
                    label="Create task when deal moves to *"
                    value={config.triggerStageId || ''}
                    onChange={(e) => setConfig(c => ({ ...c, triggerStageId: e.target.value }))}
                    options={[
                      { value: '', label: 'Any stage change' },
                      ...selectedPipeline.stages.filter((s) => !s.isWon && !s.isLost).map((s) => ({ value: s._id, label: s.name })),
                    ]}
                  />
                )}
                <p className="text-xs text-muted-foreground">Leave stage as "Any stage change" to create a task on every stage move.</p>
              </>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1" loading={isPending} disabled={!isValid()} onClick={handleActivate}>
                Activate
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ─── ACTION CONFIG (for custom builder) ──────────────────────────────────────

// Warns when an action targets a restricted pipeline. Triggers like
// contact.created can fire for any user, but a restricted pipeline is only
// visible to its allowedUsers — so a sales rep could end up creating (or
// moving) a deal they then can't see. Admins decide whether that's intended.
function RestrictedPipelineNotice({ pipeline, action }) {
  if (!pipeline || pipeline.visibility !== 'restricted') return null;
  const count = (pipeline.allowedUsers || []).length;
  const verb = action === 'create_deal'
    ? 'Deals created here will only be visible to'
    : 'After this move, the deal will only be visible to';
  return (
    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800">
        <span className="font-medium">"{pipeline.name}" is restricted</span> to {count} user{count === 1 ? '' : 's'} (plus admins).{' '}
        {verb} those users — if this automation fires for someone else, they won't see the result.
      </p>
    </div>
  );
}

function ActionConfig({ actionType, config, onChange, users, pipelines }) {
  const update = (key, value) => onChange({ ...config, [key]: value });
  const selectedPipeline = pipelines.find((p) => p._id === config.pipelineId);
  const variableHint = 'Variables: {{deal.title}}, {{contact.firstName}}, {{contact.lastName}}';

  switch (actionType) {
    case 'send_webhook':
      return (
        <div className="space-y-3">
          <Input label="Webhook URL *" placeholder="https://your-n8n.com/webhook/..." value={config.url || ''} onChange={(e) => update('url', e.target.value)} />
          <p className="text-xs text-muted-foreground">The CRM will POST the full contact/deal/task context to this URL.</p>
        </div>
      );

    case 'send_email':
      return (
        <div className="space-y-3">
          <Select
            label="Send to"
            value={config.to || 'assigned_user'}
            onChange={(e) => update('to', e.target.value)}
            options={[{ value: 'assigned_user', label: 'Assigned rep' }, { value: 'contact', label: 'Contact' }]}
          />
          <Input label="Subject" value={config.subject || ''} onChange={(e) => update('subject', e.target.value)} placeholder="e.g. Follow up with {{contact.firstName}}" />
          <Textarea label="Body (HTML supported)" value={config.body || ''} onChange={(e) => update('body', e.target.value)} rows={3} placeholder="<p>Hi {{contact.firstName}},</p>" />
          <p className="text-xs text-muted-foreground">{variableHint}</p>
        </div>
      );

    case 'send_whatsapp':
      return (
        <div className="space-y-3">
          <Select
            label="WhatsApp template *"
            value={config.whatsappTemplate || ''}
            onChange={(e) => update('whatsappTemplate', e.target.value)}
            options={[{ value: '', label: 'Select template...' }, ...WHATSAPP_TEMPLATES]}
          />
          <Select
            label="Send to"
            value={config.whatsappTo || 'assigned_user'}
            onChange={(e) => update('whatsappTo', e.target.value)}
            options={[{ value: 'assigned_user', label: 'Assigned rep' }, { value: 'contact', label: 'Contact' }]}
          />
          <p className="text-xs text-muted-foreground">Recipient must have a phone number on file. WhatsApp templates are pre-approved by Meta.</p>
        </div>
      );

    case 'create_task':
      return (
        <div className="space-y-3">
          <Input label="Task title *" value={config.taskTitle || ''} onChange={(e) => update('taskTitle', e.target.value)} placeholder="Follow up: {{deal.title}}" />
          <p className="text-xs text-muted-foreground">{variableHint}</p>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={config.taskType || 'follow_up'} onChange={(e) => update('taskType', e.target.value)}
              options={[{ value: 'follow_up', label: 'Follow up' }, { value: 'call', label: 'Call' }, { value: 'email', label: 'Email' }, { value: 'meeting', label: 'Meeting' }]} />
            <Select label="Priority" value={config.taskPriority || 'medium'} onChange={(e) => update('taskPriority', e.target.value)}
              options={[{ value: 'high', label: '🔴 High' }, { value: 'medium', label: '🟡 Medium' }, { value: 'low', label: '🟢 Low' }]} />
          </div>
          <Input label="Due in (days from trigger)" type="number" min="0" value={config.taskDueDays ?? 1} onChange={(e) => update('taskDueDays', parseInt(e.target.value))} />
          <Select label="Assign to" value={config.assignTo || 'same_as_deal'} onChange={(e) => update('assignTo', e.target.value)}
            options={[{ value: 'same_as_deal', label: 'Deal owner' }, { value: 'same_as_contact', label: 'Contact owner' }]} />
        </div>
      );

    case 'create_deal':
      return (
        <div className="space-y-3">
          <Input label="Deal title" value={config.dealTitle || '{{contact.firstName}} {{contact.lastName}} — New opportunity'} onChange={(e) => update('dealTitle', e.target.value)} />
          <Select label="Pipeline *" value={config.pipelineId || ''} onChange={(e) => onChange({ ...config, pipelineId: e.target.value, stageId: '' })}
            options={[{ value: '', label: 'Select pipeline...' }, ...pipelines.map((p) => ({ value: p._id, label: p.name }))]} />
          <RestrictedPipelineNotice pipeline={selectedPipeline} action="create_deal" />
          {selectedPipeline && (
            <Select label="Starting stage *" value={config.stageId || ''} onChange={(e) => update('stageId', e.target.value)}
              options={[{ value: '', label: 'Select stage...' }, ...selectedPipeline.stages.filter((s) => !s.isWon && !s.isLost).map((s) => ({ value: s._id, label: s.name }))]} />
          )}
          <Select label="Assign to" value={config.assignTo || 'same_as_contact'} onChange={(e) => update('assignTo', e.target.value)}
            options={[{ value: 'same_as_contact', label: 'Contact owner' }]} />
        </div>
      );

    case 'assign_to_user':
      return (
        <Select label="Assign to *" value={config.userId || ''} onChange={(e) => update('userId', e.target.value)}
          options={[{ value: '', label: 'Select team member...' }, ...users.map((u) => ({ value: u._id, label: u.name }))]} />
      );

    case 'add_tag':
      return (
        <Input label="Tag to add *" value={config.tag || ''} onChange={(e) => update('tag', e.target.value)} placeholder="e.g. hot-lead, vip" />
      );

    case 'update_deal_stage':
      return (
        <div className="space-y-3">
          <Select label="Pipeline *" value={config.pipelineId || ''} onChange={(e) => onChange({ ...config, pipelineId: e.target.value, stageId: '', stageName: '' })}
            options={[{ value: '', label: 'Select pipeline...' }, ...pipelines.map((p) => ({ value: p._id, label: p.name }))]} />
          <RestrictedPipelineNotice pipeline={selectedPipeline} action="update_deal_stage" />
          {selectedPipeline && (
            <Select label="Move deal to stage *" value={config.stageId || ''} onChange={(e) => {
              const stage = selectedPipeline.stages.find((s) => s._id === e.target.value);
              onChange({ ...config, stageId: e.target.value, stageName: stage?.name || '' });
            }}
              options={[{ value: '', label: 'Select stage...' }, ...selectedPipeline.stages.map((s) => ({ value: s._id, label: s.name }))]} />
          )}
        </div>
      );

    default:
      return null;
  }
}

// Fields available for conditions, scoped to the trigger so users don't pick a
// field that won't be in scope at runtime (e.g. `deal.value` on a
// contact.created trigger). The engine resolves dotted paths, so the right-hand
// list maps directly to what `checkConditions` walks.
const CONDITION_FIELDS = {
  contact: [
    { value: 'contact.firstName', label: 'Contact: first name' },
    { value: 'contact.lastName',  label: 'Contact: last name' },
    { value: 'contact.email',     label: 'Contact: email' },
    { value: 'contact.company',   label: 'Contact: company' },
    { value: 'contact.status',    label: 'Contact: status' },
    { value: 'contact.source',    label: 'Contact: source' },
    { value: 'contact.tags',      label: 'Contact: tags' },
  ],
  deal: [
    { value: 'deal.title',     label: 'Deal: title' },
    { value: 'deal.stageName', label: 'Deal: stage name' },
    { value: 'deal.value',     label: 'Deal: value' },
    { value: 'deal.status',    label: 'Deal: status' },
    { value: 'deal.tags',      label: 'Deal: tags' },
  ],
  task: [
    { value: 'task.title',    label: 'Task: title' },
    { value: 'task.priority', label: 'Task: priority' },
    { value: 'task.type',     label: 'Task: type' },
  ],
};

function getAvailableFields(triggerType) {
  if (!triggerType) return [];
  const prefix = triggerType.split('.')[0];
  // deal.* triggers also have access to the linked contact via populated refs;
  // task.overdue has both contact and deal in scope.
  if (prefix === 'deal')    return [...CONDITION_FIELDS.deal, ...CONDITION_FIELDS.contact];
  if (prefix === 'contact') return CONDITION_FIELDS.contact;
  if (prefix === 'task')    return [...CONDITION_FIELDS.task, ...CONDITION_FIELDS.contact, ...CONDITION_FIELDS.deal];
  return [];
}

const CONDITION_OPERATORS = [
  { value: 'equals',       label: 'equals' },
  { value: 'not_equals',   label: 'does not equal' },
  { value: 'contains',     label: 'contains' },
  { value: 'greater_than', label: 'is greater than' },
  { value: 'less_than',    label: 'is less than' },
  { value: 'exists',       label: 'is set' },
];

function ConditionsEditor({ conditions, onChange, triggerType }) {
  const fields = getAvailableFields(triggerType);
  const update = (idx, next) => onChange(conditions.map((c, i) => (i === idx ? next : c)));
  const remove = (idx) => onChange(conditions.filter((_, i) => i !== idx));
  const add = () => onChange([...conditions, { field: fields[0]?.value || '', operator: 'equals', value: '' }]);

  return (
    <div className="space-y-2">
      {conditions.map((cond, idx) => (
        <div key={idx} className="border border-border rounded-lg p-2.5 bg-muted/20 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              {idx === 0 ? 'Only when' : 'AND'}
            </span>
            <button type="button" onClick={() => remove(idx)}
              className="text-xs text-red-600 hover:text-red-700 inline-flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Remove
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={cond.field || ''}
              onChange={(e) => update(idx, { ...cond, field: e.target.value })}
              options={[{ value: '', label: 'Select field...' }, ...fields]}
            />
            <Select
              value={cond.operator || 'equals'}
              onChange={(e) => update(idx, { ...cond, operator: e.target.value })}
              options={CONDITION_OPERATORS}
            />
          </div>
          {cond.operator !== 'exists' && (
            <Input
              placeholder="Value"
              value={cond.value ?? ''}
              onChange={(e) => update(idx, { ...cond, value: e.target.value })}
            />
          )}
        </div>
      ))}
      <button type="button" onClick={add}
        disabled={fields.length === 0}
        className="w-full p-2.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-muted/50 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
        <Plus className="w-3.5 h-3.5" /> Add filter
      </button>
    </div>
  );
}

// ─── MULTI-ACTION EDITOR ──────────────────────────────────────────────────────
// Shared between CustomBuilderModal and EditAutomationModal so multi-action
// edits behave identically in both.
function MultiActionEditor({ actions, onChange, users, pipelines }) {
  const updateAction = (idx, next) => {
    onChange(actions.map((a, i) => (i === idx ? next : a)));
  };
  const removeAction = (idx) => {
    onChange(actions.filter((_, i) => i !== idx));
  };
  const addAction = () => {
    onChange([...actions, { type: 'send_webhook', config: {} }]);
  };

  return (
    <div className="space-y-3">
      {actions.map((action, idx) => (
        <div key={idx} className="border border-border rounded-lg p-3 space-y-3 bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Action {idx + 1}</span>
            {actions.length > 1 && (
              <button type="button" onClick={() => removeAction(idx)}
                className="text-xs text-red-600 hover:text-red-700 inline-flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Remove
              </button>
            )}
          </div>
          <Select
            label="Action type"
            value={action.type}
            onChange={(e) => updateAction(idx, { type: e.target.value, config: {} })}
            options={Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <ActionConfig
            actionType={action.type}
            config={action.config}
            onChange={(newConfig) => updateAction(idx, { ...action, config: newConfig })}
            users={users}
            pipelines={pipelines}
          />
        </div>
      ))}
      <button type="button" onClick={addAction}
        className="w-full p-3 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-muted/50 transition-colors inline-flex items-center justify-center gap-2">
        <Plus className="w-4 h-4" /> Add another action
      </button>
    </div>
  );
}

// Validates one action's config based on its type. Returns `null` when valid,
// or a short string explaining what's missing. Mirrors the server-side
// requirements in automations/engine.js.
function actionIsInvalid(action) {
  const c = action.config || {};
  switch (action.type) {
    case 'send_webhook':     return c.url ? null : 'Webhook URL';
    case 'send_email':       return c.subject && c.body ? null : 'Email subject and body';
    case 'send_whatsapp':    return c.whatsappTemplate ? null : 'WhatsApp template';
    case 'create_task':      return c.taskTitle ? null : 'Task title';
    case 'create_deal':      return c.pipelineId && c.stageId ? null : 'Pipeline and stage';
    case 'assign_to_user':   return c.userId ? null : 'User to assign to';
    case 'add_tag':          return c.tag ? null : 'Tag';
    case 'update_deal_stage': return c.pipelineId && c.stageId ? null : 'Pipeline and stage';
    default: return null;
  }
}

// ─── CUSTOM BUILDER MODAL ─────────────────────────────────────────────────────

function CustomBuilderModal({ open, onClose, activeTriggers = [] }) {
  const { mutateAsync, isPending } = useCreateAutomation();
  const { data: teamData } = useTeam();
  const { data: pipelinesData } = usePipelines();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '',
    triggerType: 'contact.created',
    inactiveDays: 3,
    actions: [{ type: 'send_webhook', config: {} }],
    conditions: [],
    confirmedDuplicate: false,
  });

  const users = (teamData?.users || []).filter((u) => u.isActive !== false);
  const pipelines = pipelinesData?.pipelines || [];

  const hasDuplicate = activeTriggers.includes(form.triggerType);
  const showDuplicateBlock = hasDuplicate && !form.confirmedDuplicate;
  const invalidAction = form.actions.map(actionIsInvalid).find(Boolean);

  const reset = () => {
    setStep(1);
    setForm({
      name: '', triggerType: 'contact.created', inactiveDays: 3,
      actions: [{ type: 'send_webhook', config: {} }],
      conditions: [],
      confirmedDuplicate: false,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.actions.length === 0) return;
    const triggerConfig = form.triggerType === 'deal.inactive' ? { inactiveDays: parseInt(form.inactiveDays) } : {};
    // Strip blank conditions — easy to leave a partially-filled row behind.
    const conditions = form.conditions.filter((c) => c.field && c.operator);
    await mutateAsync({
      name: form.name,
      trigger: { type: form.triggerType, config: triggerConfig },
      conditions,
      actions: form.actions,
    });
    onClose();
    reset();
  };

  const steps = ['Trigger', 'Actions', 'Review'];

  return (
    <Modal open={open} onClose={() => { onClose(); reset(); }} title="Build custom automation">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-2">
          {steps.map((label, i) => {
            const s = i + 1;
            return (
              <div key={s} className="flex items-center flex-1">
                <div className="flex items-center gap-1.5">
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold',
                    s === step ? 'bg-primary text-primary-foreground' :
                    s < step ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                  )}>
                    {s < step ? <CheckCircle2 className="w-3 h-3" /> : s}
                  </div>
                  <span className={cn('text-xs hidden sm:block', s === step ? 'text-foreground font-medium' : 'text-muted-foreground')}>{label}</span>
                </div>
                {s < 3 && <div className={cn('flex-1 h-0.5 mx-2', s < step ? 'bg-primary' : 'bg-muted')} />}
              </div>
            );
          })}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <Input label="Automation name *" placeholder="e.g. Notify team on new lead" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
            <div className="space-y-2">
              <label className="text-sm font-medium">When this happens</label>
              <div className="space-y-1.5">
                {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                  <button key={value} type="button"
                    onClick={() => setForm(f => ({ ...f, triggerType: value, confirmedDuplicate: false }))}
                    className={cn('w-full p-3 rounded-lg border text-left text-sm transition-all',
                      form.triggerType === value ? 'border-primary bg-primary/5 font-medium' : 'border-border hover:border-primary/40 hover:bg-muted/50'
                    )}>
                    {label}
                  </button>
                ))}
              </div>
              {form.triggerType === 'deal.inactive' && (
                <Input label="Inactive for how many days?" type="number" min="1" value={form.inactiveDays}
                  onChange={(e) => setForm(f => ({ ...f, inactiveDays: e.target.value }))} />
              )}
              {showDuplicateBlock && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
                  <div className="flex gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-amber-800 mb-1">You already have an active automation on this trigger</p>
                      <p className="text-xs text-amber-700 mb-2">Both will fire at the same time, which may cause duplicate tasks or emails. Continue only if that's intentional.</p>
                      <button type="button" onClick={() => setForm(f => ({ ...f, confirmedDuplicate: true }))}
                        className="text-xs font-medium text-amber-800 underline">
                        I understand — continue anyway
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium">Filters (optional)</label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">Only run when these are true. Leave empty to fire on every trigger.</p>
              <ConditionsEditor
                conditions={form.conditions}
                onChange={(conditions) => setForm(f => ({ ...f, conditions }))}
                triggerType={form.triggerType}
              />
            </div>
            <div className="border-t border-border pt-4">
              <label className="text-sm font-medium">Then do this</label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">Add one or more actions. They'll run in order each time the trigger fires.</p>
              <MultiActionEditor
                actions={form.actions}
                onChange={(actions) => setForm(f => ({ ...f, actions }))}
                users={users}
                pipelines={pipelines}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="bg-muted/40 rounded-xl p-4 border border-border space-y-3">
              <p className="text-sm font-semibold">{form.name}</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Zap className="w-3 h-3 text-blue-600" />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">When: </span>
                    <span className="text-xs">{TRIGGER_LABELS[form.triggerType]}</span>
                    {form.triggerType === 'deal.inactive' && <span className="text-xs text-muted-foreground"> (after {form.inactiveDays} days)</span>}
                  </div>
                </div>
                {form.conditions.filter((c) => c.field).map((c, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                    </div>
                    <div className="text-xs">
                      <span className="text-muted-foreground">Only when: </span>
                      <span>{c.field} {CONDITION_OPERATORS.find((o) => o.value === c.operator)?.label}{c.operator !== 'exists' ? ` "${c.value}"` : ''}</span>
                    </div>
                  </div>
                ))}
                {form.actions.map((a, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Rocket className="w-3 h-3 text-green-600" />
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Then: </span>
                      <span className="text-xs">{ACTION_LABELS[a.type]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {invalidAction && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                One of your actions is missing required config: <strong>{invalidAction}</strong>. Go back and fill it in.
              </div>
            )}
            <p className="text-xs text-muted-foreground">You can edit or pause this automation at any time from the My automations tab.</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 pt-2 border-t border-border">
          {step > 1 && <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)}>Back</Button>}
          <div className="flex-1" />
          {step < 3 ? (
            <Button type="button" onClick={() => setStep(s => s + 1)}
              disabled={
                (step === 1 && (!form.name || showDuplicateBlock)) ||
                (step === 2 && form.actions.length === 0)
              }>
              Continue
            </Button>
          ) : (
            <Button type="submit" loading={isPending} disabled={!!invalidAction}>Create automation</Button>
          )}
        </div>
      </form>
    </Modal>
  );
}

// ─── EDIT AUTOMATION MODAL ───────────────────────────────────────────────────

function EditAutomationModal({ open, onClose, automation }) {
  const { mutateAsync, isPending } = useUpdateAutomation();
  const { data: teamData } = useTeam();
  const { data: pipelinesData } = usePipelines();
  const [step, setStep] = useState(1);

  // Extract existing stage filter from conditions if present
  const existingStageCondition = automation.conditions?.find((c) => c.field === 'deal.stageName' && c.operator === 'equals');
  const existingPipeline = pipelinesData?.pipelines?.find((p) =>
    p.stages.some((s) => s.name === existingStageCondition?.value)
  );
  const existingStage = existingPipeline?.stages?.find((s) => s.name === existingStageCondition?.value);

  const [form, setForm] = useState({
    name: automation.name || '',
    triggerType: automation.trigger?.type || 'contact.created',
    inactiveDays: automation.trigger?.config?.inactiveDays || 3,
    triggerPipelineId: existingPipeline?._id || '',
    triggerStageId: existingStage?._id || '',
    actions: automation.actions?.length
      ? automation.actions.map((a) => ({ type: a.type, config: a.config || {} }))
      : [{ type: 'send_webhook', config: {} }],
    // The stage-filter dropdown owns the deal.stageName=equals condition, so
    // we exclude it here to avoid a duplicate row in the conditions UI.
    // Everything else is user-defined and editable.
    conditions: (automation.conditions || []).filter(
      (c) => !(c.field === 'deal.stageName' && c.operator === 'equals')
    ),
  });

  const users = (teamData?.users || []).filter((u) => u.isActive !== false);
  const pipelines = pipelinesData?.pipelines || [];
  const selectedTriggerPipeline = pipelines.find((p) => p._id === form.triggerPipelineId);
  const invalidAction = form.actions.map(actionIsInvalid).find(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.actions.length === 0) return;
    const triggerConfig = form.triggerType === 'deal.inactive' ? { inactiveDays: parseInt(form.inactiveDays) } : {};

    // Start from user-edited conditions (blank rows stripped), then re-attach
    // the stage-filter special case if the trigger and pipeline/stage are set.
    let conditions = form.conditions.filter((c) => c.field && c.operator);
    if (form.triggerType === 'deal.stage_changed' && form.triggerStageId && selectedTriggerPipeline) {
      const stage = selectedTriggerPipeline.stages.find((s) => s._id === form.triggerStageId);
      if (stage) conditions = [...conditions, { field: 'deal.stageName', operator: 'equals', value: stage.name }];
    }

    await mutateAsync({
      id: automation._id,
      name: form.name,
      trigger: { type: form.triggerType, config: triggerConfig },
      conditions,
      actions: form.actions,
    });
    onClose();
    setStep(1);
  };

  const steps = ['Trigger', 'Action', 'Review'];

  return (
    <Modal open={open} onClose={onClose} title={`Edit: ${automation.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-2">
          {steps.map((label, i) => {
            const s = i + 1;
            return (
              <div key={s} className="flex items-center flex-1">
                <div className="flex items-center gap-1.5">
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold',
                    s === step ? 'bg-primary text-primary-foreground' :
                    s < step ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                  )}>
                    {s < step ? <CheckCircle2 className="w-3 h-3" /> : s}
                  </div>
                  <span className={cn('text-xs hidden sm:block', s === step ? 'text-foreground font-medium' : 'text-muted-foreground')}>{label}</span>
                </div>
                {s < 3 && <div className={cn('flex-1 h-0.5 mx-2', s < step ? 'bg-primary' : 'bg-muted')} />}
              </div>
            );
          })}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <Input label="Automation name *" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
            <div className="space-y-2">
              <label className="text-sm font-medium">When this happens</label>
              <div className="space-y-1.5">
                {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setForm(f => ({ ...f, triggerType: value }))}
                    className={cn('w-full p-3 rounded-lg border text-left text-sm transition-all',
                      form.triggerType === value ? 'border-primary bg-primary/5 font-medium' : 'border-border hover:border-primary/40 hover:bg-muted/50'
                    )}>
                    {label}
                  </button>
                ))}
              </div>
              {form.triggerType === 'deal.inactive' && (
                <Input label="Inactive for how many days?" type="number" min="1" value={form.inactiveDays}
                  onChange={(e) => setForm(f => ({ ...f, inactiveDays: e.target.value }))} />
              )}
              {form.triggerType === 'deal.stage_changed' && (
                <div className="space-y-3 pt-1">
                  <Select
                    label="Which pipeline?"
                    value={form.triggerPipelineId}
                    onChange={(e) => setForm(f => ({ ...f, triggerPipelineId: e.target.value, triggerStageId: '' }))}
                    options={[{ value: '', label: 'Select pipeline...' }, ...pipelines.map((p) => ({ value: p._id, label: p.name }))]}
                  />
                  {selectedTriggerPipeline && (
                    <Select
                      label="Fire when deal moves to"
                      value={form.triggerStageId}
                      onChange={(e) => setForm(f => ({ ...f, triggerStageId: e.target.value }))}
                      options={[
                        { value: '', label: 'Any stage change' },
                        ...selectedTriggerPipeline.stages.filter((s) => !s.isWon && !s.isLost).map((s) => ({ value: s._id, label: s.name })),
                      ]}
                    />
                  )}
                  <p className="text-xs text-muted-foreground">Leave as "Any stage change" to fire on every stage move.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium">Filters (optional)</label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">Only run when these are true. Leave empty to fire on every trigger.</p>
              <ConditionsEditor
                conditions={form.conditions}
                onChange={(conditions) => setForm(f => ({ ...f, conditions }))}
                triggerType={form.triggerType}
              />
            </div>
            <div className="border-t border-border pt-4">
              <label className="text-sm font-medium">Then do this</label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">Add one or more actions. They'll run in order each time the trigger fires.</p>
              <MultiActionEditor
                actions={form.actions}
                onChange={(actions) => setForm(f => ({ ...f, actions }))}
                users={users}
                pipelines={pipelines}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="bg-muted/40 rounded-xl p-4 border border-border space-y-3">
              <p className="text-sm font-semibold">{form.name}</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Zap className="w-3 h-3 text-blue-600" />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">When: </span>
                    <span className="text-xs">{TRIGGER_LABELS[form.triggerType]}</span>
                    {form.triggerType === 'deal.inactive' && <span className="text-xs text-muted-foreground"> (after {form.inactiveDays} days)</span>}
                    {form.triggerType === 'deal.stage_changed' && form.triggerStageId && selectedTriggerPipeline && (
                      <span className="text-xs text-muted-foreground"> → {selectedTriggerPipeline.stages.find(s => s._id === form.triggerStageId)?.name}</span>
                    )}
                  </div>
                </div>
                {form.conditions.filter((c) => c.field).map((c, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                    </div>
                    <div className="text-xs">
                      <span className="text-muted-foreground">Only when: </span>
                      <span>{c.field} {CONDITION_OPERATORS.find((o) => o.value === c.operator)?.label}{c.operator !== 'exists' ? ` "${c.value}"` : ''}</span>
                    </div>
                  </div>
                ))}
                {form.actions.map((a, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Rocket className="w-3 h-3 text-green-600" />
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Then: </span>
                      <span className="text-xs">{ACTION_LABELS[a.type]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {invalidAction && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                One of your actions is missing required config: <strong>{invalidAction}</strong>. Go back and fill it in.
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2 border-t border-border">
          {step > 1 && <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)}>Back</Button>}
          <div className="flex-1" />
          {step < 3 ? (
            <Button type="button" onClick={() => setStep(s => s + 1)}
              disabled={
                (step === 1 && !form.name) ||
                (step === 2 && form.actions.length === 0)
              }>
              Continue
            </Button>
          ) : (
            <Button type="submit" loading={isPending} disabled={!!invalidAction}>Save changes</Button>
          )}
        </div>
      </form>
    </Modal>
  );
}

// ─── AUTOMATION CARD (My automations tab) ────────────────────────────────────

function AutomationCard({ auto, canWrite, onEdit, onToggle, onDelete }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const { mutate: testRun, isPending: testing } = useTestAutomation();
  const recentRuns = auto.recentRuns || [];
  const lastRun = recentRuns[0];
  const failed = lastRun?.status === 'failed' || lastRun?.status === 'partial';

  const handleTest = () => {
    const ok = confirm(
      'Test runs use real data and fire real side effects: emails will send, ' +
      'webhooks will hit your endpoints, tasks will be created. ' +
      'Continue?'
    );
    if (ok) testRun(auto._id);
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium truncate">{auto.name}</p>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1',
                auto.isActive ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
              )}>
                {auto.isActive ? <><CheckCircle2 className="w-3 h-3" /> Active</> : 'Paused'}
              </span>
              {failed && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 bg-red-100 text-red-700">
                  <AlertCircle className="w-3 h-3" /> Last run {lastRun.status}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              When: {TRIGGER_LABELS[auto.trigger?.type] || auto.trigger?.type}
            </p>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {auto.runCount > 0 && <span className="flex items-center gap-1"><Play className="w-3 h-3" />{auto.runCount} runs</span>}
              {auto.lastRunAt && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Last ran {timeAgo(auto.lastRunAt)}</span>}
              {recentRuns.length > 0 && (
                <button onClick={() => setHistoryOpen((o) => !o)}
                  className="flex items-center gap-1 hover:text-foreground transition-colors">
                  <ChevronDown className={cn('w-3 h-3 transition-transform', historyOpen && 'rotate-180')} />
                  {historyOpen ? 'Hide history' : `History (${recentRuns.length})`}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {canWrite && (
            <>
              <button onClick={handleTest} disabled={testing}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                title="Test run (fires real side effects)">
                <Play className="w-4 h-4" />
              </button>
              <button onClick={onEdit}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                title="Edit automation">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={onToggle}
                className={cn('p-1.5 rounded-lg transition-colors',
                  auto.isActive ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:bg-muted'
                )} title={auto.isActive ? 'Pause' : 'Activate'}>
                {auto.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
              </button>
              <button onClick={onDelete}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-100 hover:text-red-600 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {historyOpen && recentRuns.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          {recentRuns.map((run, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <div className="shrink-0 mt-0.5">
                {run.status === 'success'
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                  : run.status === 'partial'
                    ? <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    : <XCircle className="w-3.5 h-3.5 text-red-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-muted-foreground">{timeAgo(run.at)}</span>
                  <span className={cn('px-1.5 py-0.5 rounded text-[10px] uppercase font-medium',
                    run.status === 'success' ? 'bg-green-100 text-green-700' :
                    run.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  )}>
                    {run.status}
                  </span>
                  {run.isTest && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-medium bg-blue-100 text-blue-700">
                      Test
                    </span>
                  )}
                </div>
                {run.error && (
                  <p className="text-red-700 mt-0.5 break-words">{run.error}</p>
                )}
                {run.actions?.filter((a) => !a.success).map((a, j) => (
                  <p key={j} className="text-red-700 mt-0.5 break-words">
                    <span className="font-medium">{a.type}:</span> {a.error}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── ADVANCED TEMPLATES ───────────────────────────────────────────────────────

function AdvancedTemplates({ templates, activeTemplateIds, onActivate }) {
  const [open, setOpen] = useState(false);
  if (templates.length === 0) return null;
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
            <Brain className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">Advanced / Developer</p>
            <p className="text-xs text-muted-foreground">n8n webhooks and custom integrations</p>
          </div>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform shrink-0', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-border p-4 space-y-3 bg-muted/20">
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">These require an n8n instance or webhook URL. If you're not sure what that means, skip this for now.</p>
          </div>
          {templates.map((template) => (
            <TemplateCard key={template.id} template={template} activeTemplateIds={activeTemplateIds} onActivate={onActivate} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function Automations() {
  const { data: automationsData, isLoading } = useAutomations();
  const { data: templatesData } = useAutomationTemplates();
  const { mutate: toggle } = useToggleAutomation();
  const { mutate: remove } = useDeleteAutomation();
  const { canWrite } = useRole();
  const { canUse } = usePlan();
  const [activeTab, setActiveTab] = useState('my');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const automations = automationsData?.automations || [];
  const templates = templatesData?.templates || [];

  const activeTriggers = automations.filter((a) => a.isActive).map((a) => a.trigger?.type);
  const activeTemplateIds = automations.filter((a) => a.isActive && a.templateId).map((a) => a.templateId);

  const filteredTemplates = templates.filter((t) => {
    if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !t.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleActivateSuccess = () => {
    setSelectedTemplate(null);
    setActiveTab('my');
    toast.success('Automation activated!');
  };

  const CATEGORY_INFO = {
    core: { icon: '✨', title: 'Essential automations', desc: 'Recommended for every business' },
    deals: { icon: '💼', title: 'Deal automations', desc: 'Keep your pipeline moving' },
    tasks: { icon: '✅', title: 'Task automations', desc: 'Never miss a follow-up' },
  };

  // Gate the whole page for free users not on trial
  if (!canUse('automations')) {
    return (
      <LockedFeature feature="automations">
        <div className="space-y-5 opacity-50 pointer-events-none">
          <div className="h-10 bg-muted rounded-lg w-48" />
          <div className="h-32 bg-muted rounded-xl" />
          <div className="h-32 bg-muted rounded-xl" />
        </div>
      </LockedFeature>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold">Automations</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Automate your workflow so nothing slips through</p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setShowBuilder(true)}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Custom automation</span>
            <span className="sm:hidden">Custom</span>
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {[
          { id: 'my', label: 'My automations', count: automations.length },
          { id: 'templates', label: 'Templates', count: templates.filter(t => t.category !== 'advanced').length },
        ].map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={cn('px-4 py-2.5 text-sm font-medium transition-colors relative',
              activeTab === t.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}>
            {t.label}
            {t.count > 0 && (
              <span className={cn('ml-1.5 px-1.5 py-0.5 text-xs rounded-full',
                activeTab === t.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              )}>{t.count}</span>
            )}
            {activeTab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
          </button>
        ))}
      </div>

      {/* My automations */}
      {activeTab === 'my' && (
        isLoading ? <div className="flex justify-center py-12"><Spinner /></div> :
        automations.length === 0 ? (
          <EmptyState icon={Zap} title="No automations yet"
            description="Use a template or build a custom automation"
            action={canWrite ? (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setActiveTab('templates')}>Browse templates</Button>
                <Button onClick={() => setShowBuilder(true)}><Plus className="w-4 h-4" />Build custom</Button>
              </div>
            ) : null}
          />
        ) : (
          <div className="space-y-3">
            {automations.map((auto) => (
              <AutomationCard
                key={auto._id}
                auto={auto}
                canWrite={canWrite}
                onEdit={() => setEditingAutomation(auto)}
                onToggle={() => toggle(auto._id)}
                onDelete={() => { if (confirm('Delete this automation?')) remove(auto._id); }}
              />
            ))}
          </div>
        )
      )}

      {/* Templates */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          {/* Search + category filter */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { id: 'all', label: 'All' },
                { id: 'core', label: '✨ Essential' },
                { id: 'deals', label: '💼 Deals' },
                { id: 'tasks', label: '✅ Tasks' },
              ].map((cat) => (
                <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                  className={cn('px-3 py-1.5 text-sm rounded-full transition-colors',
                    selectedCategory === cat.id ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  )}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Templates by category */}
          {['core', 'deals', 'tasks'].map((category) => {
            const categoryTemplates = filteredTemplates.filter((t) => t.category === category);
            if (categoryTemplates.length === 0) return null;
            const info = CATEGORY_INFO[category];
            return (
              <div key={category} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{info.icon}</span>
                  <div>
                    <p className="text-sm font-semibold">{info.title}</p>
                    <p className="text-xs text-muted-foreground">{info.desc}</p>
                  </div>
                </div>
                {categoryTemplates.map((template) => (
                  <TemplateCard key={template.id} template={template} activeTemplateIds={activeTemplateIds} onActivate={setSelectedTemplate} />
                ))}
              </div>
            );
          })}

          {/* Advanced */}
          {(selectedCategory === 'all' || selectedCategory === 'advanced') && (
            <AdvancedTemplates
              templates={filteredTemplates.filter((t) => t.category === 'advanced')}
              activeTemplateIds={activeTemplateIds}
              onActivate={setSelectedTemplate}
            />
          )}
        </div>
      )}

      <ActivateTemplateModal
        key={selectedTemplate?.id || 'no-template'}
        open={!!selectedTemplate}
        onClose={() => setSelectedTemplate(null)}
        onSuccess={handleActivateSuccess}
        template={selectedTemplate}
        hasDuplicate={activeTriggers.includes(selectedTemplate?.trigger?.type)}
      />
      <CustomBuilderModal
        open={showBuilder}
        onClose={() => setShowBuilder(false)}
        activeTriggers={activeTriggers}
      />
      {editingAutomation && (
        <EditAutomationModal
          open={!!editingAutomation}
          onClose={() => setEditingAutomation(null)}
          automation={editingAutomation}
        />
      )}
    </div>
  );
}