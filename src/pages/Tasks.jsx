import { useState } from 'react';
import { CheckSquare, Square, Plus, Trash2, AlertCircle, ChevronDown } from 'lucide-react';
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from '@/hooks/useData';
import { useContacts, useTeam } from '@/hooks/useData';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/hooks/useRole';
import { Button, Modal, Input, Select, Textarea, Spinner, EmptyState, Card, Badge } from '@/components/ui';
import { dueDateLabel, formatDate, PRIORITY_COLORS, TASK_TYPE_ICONS, cn } from '@/lib/utils';

function CreateTaskModal({ open, onClose }) {
  const { mutateAsync, isPending } = useCreateTask();
  const { user } = useAuth();
  const { data: contactsData } = useContacts({ limit: 100 });
  const { data: teamData } = useTeam();
  const [form, setForm] = useState({
    title: '', type: 'follow_up', priority: 'medium', dueDate: '', dueTime: '',
    assignedTo: user?._id || '', contact: '', description: '',
    reminderOffset: '',
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { reminderOffset, dueDate, dueTime, ...rest } = form;

    // Combine date + time into a single datetime string
    // Default to 09:00 if no time set so sendAt computes correctly
    const dueDatetime = dueDate
      ? `${dueDate}T${dueTime || '09:00'}`
      : undefined;

    const payload = { ...rest };
    if (dueDatetime) payload.dueDate = dueDatetime;
    if (dueTime) payload.dueTime = dueTime;

    if (reminderOffset && dueDatetime) {
      // All select values are already in minutes - send as-is
      payload.reminder = { offset: parseInt(reminderOffset), unit: 'minutes' };
    }

    await mutateAsync(payload);
    onClose();
    setForm({
      title: '', type: 'follow_up', priority: 'medium', dueDate: '', dueTime: '',
      assignedTo: user?._id || '', contact: '', description: '',
      reminderOffset: '',
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Create task">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Task title *" placeholder="e.g. Follow up with John about proposal" value={form.title} onChange={set('title')} required />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Type"
            value={form.type}
            onChange={set('type')}
            options={[
              { value: 'follow_up', label: '🔁 Follow up' },
              { value: 'call', label: '📞 Call' },
              { value: 'email', label: '✉️ Email' },
              { value: 'meeting', label: '🤝 Meeting' },
              { value: 'demo', label: '💻 Demo' },
              { value: 'other', label: '📌 Other' },
            ]}
          />
          <Select
            label="Priority"
            value={form.priority}
            onChange={set('priority')}
            options={[
              { value: 'high', label: '🔴 High' },
              { value: 'medium', label: '🟡 Medium' },
              { value: 'low', label: '🟢 Low' },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Due date" type="date" value={form.dueDate} onChange={set('dueDate')} />
          <Input label="Due time" type="time" value={form.dueTime} onChange={set('dueTime')} />
        </div>

        <Select
          label="Assign to"
          value={form.assignedTo}
          onChange={set('assignedTo')}
          options={[
            { value: '', label: 'Select...' },
            ...(teamData?.users || []).filter((u) => u.isActive !== false).map((u) => ({
              value: u._id,
              label: u.role === 'viewer' ? `${u.name} (viewer)` : u.name,
            })),
          ]}
        />

        {/* Reminder - only show if both date and time are set */}
        {form.dueDate && form.dueTime && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Remind me</label>
            <select
              value={form.reminderOffset}
              onChange={set('reminderOffset')}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">No reminder</option>
              <option value="15">15 minutes before</option>
              <option value="30">30 minutes before</option>
              <option value="60">1 hour before</option>
              <option value="120">2 hours before</option>
              <option value="1440">1 day before</option>
              <option value="2880">2 days before</option>
            </select>
            {form.reminderOffset && (
              <p className="text-xs text-muted-foreground">
                Reminder sends at{' '}
                <strong>
                  {new Date(
                    new Date(`${form.dueDate}T${form.dueTime}`).getTime() -
                    parseInt(form.reminderOffset) * 60 * 1000
                  ).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                </strong>{' '}
                on{' '}
                <strong>
                  {new Date(
                    new Date(`${form.dueDate}T${form.dueTime}`).getTime() -
                    parseInt(form.reminderOffset) * 60 * 1000
                  ).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                </strong>.
                {' '}Email goes to the assigned person.
              </p>
            )}
          </div>
        )}
        <Select
          label="Link to contact"
          value={form.contact}
          onChange={set('contact')}
          options={[
            { value: '', label: 'No contact' },
            ...(contactsData?.contacts || []).map((c) => ({
              value: c._id,
              label: `${c.firstName} ${c.lastName}${c.company ? ` (${c.company})` : ''}`,
            })),
          ]}
        />
        <Textarea label="Notes" value={form.description} onChange={set('description')} rows={2} />
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isPending}>Create task</Button>
        </div>
      </form>
    </Modal>
  );
}

function TaskRow({ task }) {
  const { mutate: updateTask } = useUpdateTask();
  const { mutate: deleteTask } = useDeleteTask();
  const { canWrite } = useRole();
  const [expanded, setExpanded] = useState(false);
  const completed = task.status === 'completed';
  const due = dueDateLabel(task.dueDate);

  return (
    <div className={cn(
      'border-b border-border last:border-0 transition-colors',
      completed && 'opacity-60'
    )}>
      {/* Main row */}
      <div
        className="flex items-center gap-3 px-4 py-3 group hover:bg-muted/20 transition-colors cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Checkbox - stop propagation so clicking it doesn't toggle expand */}
        <button
          onClick={(e) => { e.stopPropagation(); canWrite && updateTask({ id: task._id, status: completed ? 'pending' : 'completed' }); }}
          className={cn('shrink-0 transition-colors', canWrite ? 'hover:text-primary cursor-pointer text-muted-foreground' : 'cursor-default text-muted-foreground')}
          disabled={!canWrite}
        >
          {completed
            ? <CheckSquare className="w-4 h-4 text-green-600" />
            : <Square className="w-4 h-4" />
          }
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{TASK_TYPE_ICONS[task.type]}</span>
            <span className={cn('text-sm', completed && 'line-through text-muted-foreground')}>
              {task.title}
            </span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', PRIORITY_COLORS[task.priority])}>
              {task.priority}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {task.contact && (
              <span className="text-xs text-muted-foreground">
                {task.contact.firstName} {task.contact.lastName}
              </span>
            )}
            {due && (
              <span className={cn('text-xs font-medium flex items-center gap-1', due.color)}>
                {due.color === 'text-red-500' && <AlertCircle className="w-3 h-3" />}
                {due.label}
              </span>
            )}
            {task.reminder?.offset && !task.reminder?.sent && (
              <span className="text-xs text-muted-foreground">
                🔔 {task.reminder.offset >= 1440
                  ? `${task.reminder.offset / 1440}d reminder`
                  : task.reminder.offset >= 60
                    ? `${task.reminder.offset / 60}h reminder`
                    : `${task.reminder.offset}m reminder`}
              </span>
            )}
            {task.reminder?.sent && (
              <span className="text-xs text-muted-foreground">🔔 Reminder sent</span>
            )}
            {task.assignedTo && (
              <span className="text-xs text-muted-foreground">→ {task.assignedTo.name}</span>
            )}
          </div>
        </div>

        {/* Expand indicator + delete */}
        <div className="flex items-center gap-1 shrink-0">
          {canWrite && (
            <button
              onClick={(e) => { e.stopPropagation(); deleteTask(task._id); }}
              className="p-1.5 rounded hover:bg-red-100 hover:text-red-600 transition-colors text-muted-foreground opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={cn(
            'w-4 h-4 text-muted-foreground transition-transform duration-200',
            expanded && 'rotate-180'
          )} />
        </div>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="px-12 pb-4 space-y-3 bg-muted/10">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Type</p>
              <p className="capitalize">{task.type.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Status</p>
              <p className="capitalize">{task.status.replace('_', ' ')}</p>
            </div>
            {task.dueDate && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Due date</p>
                <p>{formatDate(task.dueDate, 'dd MMM yyyy')} {task.dueTime && `at ${task.dueTime}`}</p>
              </div>
            )}
            {task.assignedTo && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Assigned to</p>
                <p>{task.assignedTo.name}</p>
              </div>
            )}
            {task.contact && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Contact</p>
                <p>{task.contact.firstName} {task.contact.lastName}</p>
              </div>
            )}
            {task.deal && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Deal</p>
                <p>{task.deal.title}</p>
              </div>
            )}
          </div>

          {task.description && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Notes</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {task.reminder?.offset && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Reminder</p>
              <p className="text-sm">
                {task.reminder.offset >= 1440
                  ? `${task.reminder.offset / 1440} day(s) before`
                  : task.reminder.offset >= 60
                    ? `${task.reminder.offset / 60} hour(s) before`
                    : `${task.reminder.offset} minute(s) before`}
                {' '}· {task.reminder.sent ? '✓ Sent' : 'Pending'}
              </p>
            </div>
          )}

          {task.completedAt && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Completed</p>
              <p className="text-sm">{formatDate(task.completedAt, 'dd MMM yyyy HH:mm')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Tasks() {
  const { user } = useAuth();
  const { canWrite } = useRole();
  const [filter, setFilter] = useState('my');
  const [status, setStatus] = useState('pending');
  const [showCreate, setShowCreate] = useState(false);

  const params = {
    status: status || undefined,
    assignedTo: filter === 'my' ? user._id : undefined,
    overdue: filter === 'overdue' ? 'true' : undefined,
    limit: 50,
  };

  const { data, isLoading } = useTasks(params);
  const tasks = data?.tasks || [];

  const filters = [
    { id: 'my', label: 'My tasks' },
    { id: 'all', label: 'All tasks' },
    { id: 'overdue', label: 'Overdue' },
  ];

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 flex-wrap">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'px-3 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-colors',
                filter === f.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border bg-background text-sm flex-1 sm:flex-none"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </select>
          {canWrite && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New task</span>
            </Button>
          )}
        </div>
      </div>

      {/* Task list */}
      <Card>
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="No tasks"
            description={filter === 'overdue' ? 'No overdue tasks — great work!' : 'Create a task to track your follow-ups'}
            action={canWrite ? <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" />Create task</Button> : null}
          />
        ) : (
          <div>
            {tasks.map((task) => <TaskRow key={task._id} task={task} />)}
          </div>
        )}
        {data?.pagination && (
          <div className="px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">{data.pagination.total} tasks total</p>
          </div>
        )}
      </Card>

      <CreateTaskModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}