import { useState, useMemo, useEffect } from 'react';
import { CheckSquare, Square, Plus, Trash2, AlertCircle, ChevronLeft, ChevronRight, List, Calendar as CalendarIcon, Repeat, Pencil, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from '@/hooks/useData';
import { useContacts, useTeam } from '@/hooks/useData';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/hooks/useRole';
import { Button, Modal, Input, Select, Textarea, Spinner, EmptyState, Card, Badge } from '@/components/ui';
import { dueDateLabel, formatDate, PRIORITY_COLORS, TASK_TYPE_ICONS, cn } from '@/lib/utils';
import { startOfWeek, endOfWeek, addDays, isToday, format, startOfDay, endOfDay } from 'date-fns';

function TaskFormModal({ open, onClose, prefillDate, task }) {
  const isEdit = !!task;
  const { mutateAsync: createTask, isPending: isCreating } = useCreateTask();
  const { mutateAsync: updateTask, isPending: isUpdating } = useUpdateTask();
  const isPending = isCreating || isUpdating;
  const { user } = useAuth();
  const { data: contactsData } = useContacts({ limit: 100 });
  const { data: teamData } = useTeam();
  // Initial dueDate seeded from existing task (edit) or prefillDate (calendar day click).
  // Caller passes a `key` tied to task._id / prefillDate so remount picks up changes.
  const initialDueDate = isEdit && task.dueDate
    ? format(new Date(task.dueDate), 'yyyy-MM-dd')
    : prefillDate ? format(prefillDate, 'yyyy-MM-dd') : '';
  const [form, setForm] = useState(() => isEdit ? {
    title: task.title || '',
    type: task.type || 'follow_up',
    priority: task.priority || 'medium',
    dueDate: initialDueDate,
    dueTime: task.dueTime || '',
    assignedTo: task.assignedTo?._id || task.assignedTo || '',
    contact: task.contact?._id || task.contact || '',
    description: task.description || '',
    reminderOffset: task.reminder?.offset ? String(task.reminder.offset) : '',
    recurring: !!task.recurrence?.interval,
    recurInterval: task.recurrence?.interval || 30,
    recurUnit: task.recurrence?.unit || 'day',
  } : {
    title: '', type: 'follow_up', priority: 'medium', dueDate: initialDueDate, dueTime: '',
    assignedTo: user?._id || '', contact: '', description: '',
    reminderOffset: '',
    recurring: false, recurInterval: 30, recurUnit: 'day',
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { reminderOffset, recurring, recurInterval, recurUnit, dueDate, dueTime, ...rest } = form;

    // Combine date + time into a single datetime string with EAT offset (+03:00)
    // Without this, the server treats the time as UTC causing a 3-hour shift
    const dueDatetime = dueDate
      ? `${dueDate}T${dueTime || '09:00'}:00+03:00`
      : undefined;

    const payload = { ...rest };
    if (dueDatetime) payload.dueDate = dueDatetime;
    if (dueTime) payload.dueTime = dueTime;

    if (reminderOffset && dueDatetime) {
      // All select values are already in minutes - send as-is
      payload.reminder = { offset: parseInt(reminderOffset), unit: 'minutes' };
    } else if (isEdit && task.reminder?.offset) {
      // Reminder cleared on edit
      payload.reminder = null;
    }

    if (recurring && dueDatetime) {
      payload.recurrence = { interval: parseInt(recurInterval) || 1, unit: recurUnit };
    } else if (isEdit && task.recurrence?.interval) {
      payload.recurrence = null;
    }

    if (isEdit) {
      await updateTask({ id: task._id, ...payload });
      toast.success('Task updated');
    } else {
      await createTask(payload);
    }
    onClose();
    if (!isEdit) {
      setForm({
        title: '', type: 'follow_up', priority: 'medium', dueDate: '', dueTime: '',
        assignedTo: user?._id || '', contact: '', description: '',
        reminderOffset: '',
        recurring: false, recurInterval: 30, recurUnit: 'day',
      });
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit task' : 'Create task'}>
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
        {/* Recurrence — only when there's a due date */}
        {form.dueDate && (
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.recurring}
                onChange={(e) => setForm((f) => ({ ...f, recurring: e.target.checked }))}
                className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
              />
              <Repeat className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">Repeat after completion</span>
            </label>
            {form.recurring && (
              <div className="flex items-center gap-2 pl-6">
                <span className="text-xs text-muted-foreground">Every</span>
                <input
                  type="number"
                  min="1"
                  value={form.recurInterval}
                  onChange={(e) => setForm((f) => ({ ...f, recurInterval: e.target.value }))}
                  className="w-16 h-8 px-2 rounded-md border border-border bg-background text-sm text-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <select
                  value={form.recurUnit}
                  onChange={(e) => setForm((f) => ({ ...f, recurUnit: e.target.value }))}
                  className="h-8 px-2 rounded-md border border-border bg-background text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="day">day(s)</option>
                  <option value="week">week(s)</option>
                  <option value="month">month(s)</option>
                </select>
                <span className="text-xs text-muted-foreground">after completion</span>
              </div>
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
          <Button type="submit" className="flex-1" loading={isPending}>{isEdit ? 'Save changes' : 'Create task'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// Toast with an Undo action, shown after marking a task complete.
// Without this, completing a task can feel like a deletion — the toast both
// confirms the state change and offers a one-click reversal.
function showCompleteUndoToast({ taskId, updateTask }) {
  toast.custom((t) => (
    <div className={cn(
      'flex items-center gap-3 bg-background border border-border rounded-lg shadow-lg px-4 py-3 text-sm',
      t.visible ? 'animate-in fade-in slide-in-from-bottom-2' : 'animate-out fade-out'
    )}>
      <CheckSquare className="w-4 h-4 text-green-600 shrink-0" />
      <span className="text-foreground">Task completed</span>
      <button
        onClick={() => {
          updateTask({ id: taskId, status: 'pending' });
          toast.dismiss(t.id);
        }}
        className="text-primary font-medium hover:underline ml-2"
      >
        Undo
      </button>
    </div>
  ), { duration: 5000 });
}

function TaskRow({ task, onOpen }) {
  const { mutate: updateTask } = useUpdateTask();
  const { mutate: deleteTask } = useDeleteTask();
  const { canWrite } = useRole();
  const completed = task.status === 'completed';
  const due = dueDateLabel(task.dueDate);

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!canWrite) return;
    const nextStatus = completed ? 'pending' : 'completed';
    updateTask({ id: task._id, status: nextStatus });
    if (!completed) showCompleteUndoToast({ taskId: task._id, updateTask });
  };

  return (
    <div className={cn(
      'border-b border-border last:border-0 transition-colors',
      completed && 'opacity-60'
    )}>
      <div
        className="flex items-center gap-3 px-4 py-3 group hover:bg-muted/20 transition-colors cursor-pointer"
        onClick={() => onOpen?.(task)}
      >
        <button
          onClick={handleToggle}
          className={cn('shrink-0 transition-colors', canWrite ? 'hover:text-primary cursor-pointer text-muted-foreground' : 'cursor-default text-muted-foreground')}
          disabled={!canWrite}
          aria-label={completed ? 'Mark task pending' : 'Mark task complete'}
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
            {task.recurrence?.interval && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-0.5">
                <Repeat className="w-3 h-3" />
                every {task.recurrence.interval} {task.recurrence.unit}{task.recurrence.interval > 1 ? 's' : ''}
              </span>
            )}
            {task.assignedTo && (
              <span className="text-xs text-muted-foreground">→ {task.assignedTo.name}</span>
            )}
          </div>
        </div>

        {canWrite && (
          <button
            onClick={(e) => { e.stopPropagation(); deleteTask(task._id); }}
            className="p-1.5 rounded hover:bg-red-100 hover:text-red-600 transition-colors text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0"
            aria-label="Delete task"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── CALENDAR VIEW ────────────────────────────────────────────────────────────

const PRIORITY_DOTS = {
  high:   'bg-red-500',
  medium: 'bg-amber-500',
  low:    'bg-gray-400',
};

function CalendarTaskCard({ task, onClick, onDragStart }) {
  const completed = task.status === 'completed';
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onClick={onClick}
      className={cn(
        'group bg-background border border-border rounded-lg p-2 cursor-grab active:cursor-grabbing hover:border-primary/40 hover:shadow-sm transition-all',
        completed && 'opacity-50'
      )}
    >
      <div className="flex items-start gap-1.5">
        <span className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', PRIORITY_DOTS[task.priority] || PRIORITY_DOTS.medium)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <span>{TASK_TYPE_ICONS[task.type]}</span>
            {task.dueTime && <span>{task.dueTime}</span>}
          </div>
          <p className={cn('text-xs mt-0.5 leading-snug', completed && 'line-through')}>{task.title}</p>
          {task.contact && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {task.contact.firstName} {task.contact.lastName}
            </p>
          )}
        </div>
        {task.assignedTo && (
          <div
            className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-semibold text-primary shrink-0"
            title={task.assignedTo.name}
          >
            {task.assignedTo.name?.[0] || '?'}
          </div>
        )}
      </div>
    </div>
  );
}

function DayColumn({ date, tasks, isWeekView, onDrop, onDragOverDay, onCardClick, onCardDragStart, onCreate, canWrite }) {
  const [isOver, setIsOver] = useState(false);
  const today = isToday(date);

  return (
    <div
      className={cn(
        'flex flex-col min-w-0',
        isWeekView ? 'flex-1 min-w-[140px]' : 'flex-1'
      )}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOverDay?.();
        if (!isOver) setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        setIsOver(false);
        onDrop(e, date);
      }}
    >
      <div className={cn(
        'flex items-center justify-between px-2 py-1.5 rounded-t-lg border-b-0 border border-border',
        today ? 'bg-primary/5' : 'bg-muted/30'
      )}>
        <div>
          <p className={cn('text-[11px] font-semibold uppercase tracking-wide', today ? 'text-primary' : 'text-muted-foreground')}>
            {format(date, 'EEE')}
          </p>
          <p className={cn('text-sm font-bold', today ? 'text-primary' : 'text-foreground')}>
            {format(date, 'd MMM')}
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => onCreate(date)}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
            aria-label={`Add task on ${format(date, 'd MMM')}`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className={cn(
        'flex-1 border border-t-0 border-border rounded-b-lg p-1.5 space-y-1.5 min-h-[280px] transition-colors',
        isOver ? 'bg-primary/5 border-primary/40' : 'bg-background'
      )}>
        {tasks.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/70 text-center py-4">
            {isOver ? 'Drop here' : '—'}
          </p>
        ) : (
          tasks.map((task) => (
            <CalendarTaskCard
              key={task._id}
              task={task}
              onClick={() => onCardClick(task)}
              onDragStart={onCardDragStart}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CalendarHeader({ anchorDate, mode, onModeChange, onPrev, onNext, onToday }) {
  const label = mode === 'week'
    ? (() => {
        const start = startOfWeek(anchorDate, { weekStartsOn: 1 });
        const end = addDays(start, 6);
        const sameMonth = format(start, 'MMM') === format(end, 'MMM');
        return sameMonth
          ? `${format(start, 'd')} – ${format(end, 'd MMM yyyy')}`
          : `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`;
      })()
    : format(anchorDate, 'EEEE, d MMMM yyyy');

  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={onToday}>Today</Button>
        <button
          onClick={onPrev}
          className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={onNext}
          className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
          aria-label="Next"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold ml-2">{label}</span>
      </div>
      <div className="flex items-center gap-1 p-0.5 rounded-lg border border-border bg-muted/30">
        <button
          onClick={() => onModeChange('day')}
          className={cn('px-3 py-1 text-xs font-medium rounded-md transition-colors',
            mode === 'day' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
        >
          Day
        </button>
        <button
          onClick={() => onModeChange('week')}
          className={cn('px-3 py-1 text-xs font-medium rounded-md transition-colors',
            mode === 'week' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
        >
          Week
        </button>
      </div>
    </div>
  );
}

// Right-side slide-in detail panel. Replaces the old centered "QuickPanel" modal
// and the inline expand-row pattern, so opening a task feels like opening a
// record (not toggling an accordion or popping a dialog).
function TaskDetailPanel({ task, open, onClose, onEdit }) {
  const { mutate: updateTask } = useUpdateTask();
  const { mutate: deleteTask } = useDeleteTask();
  const { canWrite } = useRole();

  // Lock body scroll while the panel is open so background content doesn't drift
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!task) return null;
  const completed = task.status === 'completed';

  const handleToggle = () => {
    const nextStatus = completed ? 'pending' : 'completed';
    updateTask({ id: task._id, status: nextStatus });
    if (!completed) showCompleteUndoToast({ taskId: task._id, updateTask });
    onClose();
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 transition-opacity',
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      )}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        role="dialog"
        aria-labelledby="task-detail-title"
        className={cn(
          'absolute right-0 top-0 h-full w-full max-w-md bg-background border-l border-border shadow-xl flex flex-col transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm">{TASK_TYPE_ICONS[task.type]}</span>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', PRIORITY_COLORS[task.priority])}>
                {task.priority}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground capitalize">
                {task.status.replace('_', ' ')}
              </span>
            </div>
            <h2
              id="task-detail-title"
              className={cn('text-base font-semibold leading-snug', completed && 'line-through text-muted-foreground')}
            >
              {task.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-muted transition-colors shrink-0"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Type</p>
              <p className="capitalize">{task.type.replace('_', ' ')}</p>
            </div>
            {task.dueDate && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Due</p>
                <p>{formatDate(task.dueDate, 'd MMM yyyy')} {task.dueTime && `at ${task.dueTime}`}</p>
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
            {task.completedAt && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Completed</p>
                <p>{formatDate(task.completedAt, 'd MMM yyyy HH:mm')}</p>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Notes</p>
            <p className="text-sm whitespace-pre-wrap">
              {task.description || <span className="text-muted-foreground italic">No notes</span>}
            </p>
          </div>

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

          {task.recurrence?.interval && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Repeats</p>
              <p className="text-sm inline-flex items-center gap-1">
                <Repeat className="w-3 h-3" />
                every {task.recurrence.interval} {task.recurrence.unit}{task.recurrence.interval > 1 ? 's' : ''} after completion
              </p>
            </div>
          )}
        </div>

        {canWrite && (
          <div className="flex gap-2 px-5 py-4 border-t border-border bg-muted/20">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleToggle}
            >
              <CheckSquare className="w-4 h-4" />
              {completed ? 'Mark pending' : 'Mark complete'}
            </Button>
            <Button
              variant="outline"
              onClick={() => onEdit?.(task)}
              aria-label="Edit task"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              className="text-red-600 hover:bg-red-50 hover:border-red-200"
              onClick={() => {
                deleteTask(task._id);
                onClose();
              }}
              aria-label="Delete task"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskCalendar({ assignedTo }) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [mode, setMode] = useState('week');
  const [selectedTask, setSelectedTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [createPrefill, setCreatePrefill] = useState(null); // Date | null
  const { canWrite } = useRole();
  const { mutate: updateTask } = useUpdateTask();

  // Compute the date range for this view
  const { rangeStart, rangeEnd, days } = useMemo(() => {
    if (mode === 'week') {
      const start = startOfWeek(anchor, { weekStartsOn: 1 });
      const end = endOfWeek(anchor, { weekStartsOn: 1 });
      const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      return { rangeStart: startOfDay(start), rangeEnd: endOfDay(end), days };
    }
    return { rangeStart: startOfDay(anchor), rangeEnd: endOfDay(anchor), days: [anchor] };
  }, [anchor, mode]);

  const { data, isLoading } = useTasks({
    from: rangeStart.toISOString(),
    to: rangeEnd.toISOString(),
    assignedTo,
    limit: 200,
  });

  // Stable reference across renders when data hasn't changed — keeps deps quiet
  const tasks = useMemo(() => data?.tasks || [], [data]);

  // Group by day key (yyyy-MM-dd)
  const byDay = useMemo(() => {
    const map = new Map();
    days.forEach((d) => map.set(format(d, 'yyyy-MM-dd'), []));
    tasks.forEach((t) => {
      if (!t.dueDate) return;
      const key = format(new Date(t.dueDate), 'yyyy-MM-dd');
      if (map.has(key)) map.get(key).push(t);
    });
    // Sort each day by time
    map.forEach((list) => {
      list.sort((a, b) => {
        const at = a.dueTime || '';
        const bt = b.dueTime || '';
        if (at && bt) return at.localeCompare(bt);
        if (at) return -1;
        if (bt) return 1;
        return 0;
      });
    });
    return map;
  }, [tasks, days]);

  const handleDragStart = (e, task) => {
    e.dataTransfer.setData('text/task-id', task._id);
    e.dataTransfer.setData('text/task-time', task.dueTime || '');
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e, day) => {
    if (!canWrite) return;
    e.preventDefault();
    const id = e.dataTransfer.getData('text/task-id');
    const time = e.dataTransfer.getData('text/task-time') || '09:00';
    if (!id) return;

    // Build new dueDate at the dropped day with original time, EAT offset (matches TaskFormModal)
    const yyyy = format(day, 'yyyy-MM-dd');
    const newDueDate = `${yyyy}T${time}:00+03:00`;
    updateTask({ id, dueDate: newDueDate, dueTime: time });
  };

  const goPrev = () => setAnchor((d) => addDays(d, mode === 'week' ? -7 : -1));
  const goNext = () => setAnchor((d) => addDays(d, mode === 'week' ? 7 : 1));
  const goToday = () => setAnchor(new Date());

  return (
    <div className="space-y-3">
      <CalendarHeader
        anchorDate={anchor}
        mode={mode}
        onModeChange={setMode}
        onPrev={goPrev}
        onNext={goNext}
        onToday={goToday}
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <div className={cn(
          'flex gap-2',
          mode === 'week' && 'overflow-x-auto pb-2'
        )}>
          {days.map((day) => (
            <DayColumn
              key={day.toISOString()}
              date={day}
              tasks={byDay.get(format(day, 'yyyy-MM-dd')) || []}
              isWeekView={mode === 'week'}
              onDrop={handleDrop}
              onCardClick={setSelectedTask}
              onCardDragStart={handleDragStart}
              onCreate={(d) => setCreatePrefill(d)}
              canWrite={canWrite}
            />
          ))}
        </div>
      )}

      <TaskDetailPanel
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onEdit={(t) => { setEditingTask(t); setSelectedTask(null); }}
      />

      <TaskFormModal
        key={createPrefill ? createPrefill.toISOString() : 'no-prefill'}
        open={!!createPrefill}
        onClose={() => setCreatePrefill(null)}
        prefillDate={createPrefill}
      />

      <TaskFormModal
        key={editingTask?._id || 'no-edit'}
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        task={editingTask}
      />
    </div>
  );
}

export default function Tasks() {
  const { user } = useAuth();
  const { canWrite } = useRole();
  const [view, setView] = useState('list'); // 'list' | 'calendar'
  const [filter, setFilter] = useState('my');
  // Default to "All statuses" (was 'pending') — completing a task should not
  // make it vanish from view; the strike-through + dimmed styling already
  // distinguishes completed tasks.
  const [status, setStatus] = useState('');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);

  // hideCompleted only takes effect when no specific status filter is set;
  // otherwise the dropdown is authoritative.
  const params = {
    status: status || undefined,
    excludeStatus: !status && hideCompleted ? 'completed' : undefined,
    assignedTo: filter === 'my' ? user._id : undefined,
    overdue: filter === 'overdue' ? 'true' : undefined,
    limit: 50,
  };

  const { data, isLoading } = useTasks(params, { enabled: view === 'list' });
  const tasks = data?.tasks || [];

  const filters = [
    { id: 'my', label: 'My tasks' },
    { id: 'all', label: 'All tasks' },
    { id: 'overdue', label: 'Overdue' },
  ];

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg border border-border bg-muted/30">
            <button
              onClick={() => setView('list')}
              className={cn('flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                view === 'list' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              aria-label="List view"
            >
              <List className="w-3.5 h-3.5" /> List
            </button>
            <button
              onClick={() => setView('calendar')}
              className={cn('flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                view === 'calendar' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              aria-label="Calendar view"
            >
              <CalendarIcon className="w-3.5 h-3.5" /> Calendar
            </button>
          </div>

          {view === 'list' && filters.map((f) => (
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

          {/* In calendar view, simpler my/all toggle */}
          {view === 'calendar' && ['my', 'all'].map((id) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={cn(
                'px-3 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-colors',
                filter === id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
              )}
            >
              {id === 'my' ? 'My tasks' : 'All tasks'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {view === 'list' && (
            <>
              <label
                className={cn(
                  'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border cursor-pointer select-none transition-colors',
                  status ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted',
                )}
                title={status ? 'Disabled while a specific status is selected' : ''}
              >
                <input
                  type="checkbox"
                  checked={hideCompleted}
                  disabled={!!status}
                  onChange={(e) => setHideCompleted(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-border accent-primary"
                />
                Hide completed
              </label>
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
            </>
          )}
          {canWrite && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New task</span>
            </Button>
          )}
        </div>
      </div>

      {view === 'calendar' ? (
        <TaskCalendar assignedTo={filter === 'my' ? user._id : undefined} />
      ) : (
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
              {tasks.map((task) => (
                <TaskRow key={task._id} task={task} onOpen={setSelectedTask} />
              ))}
            </div>
          )}
          {data?.pagination && (
            <div className="px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">{data.pagination.total} tasks total</p>
            </div>
          )}
        </Card>
      )}

      <TaskDetailPanel
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onEdit={(t) => { setEditingTask(t); setSelectedTask(null); }}
      />

      <TaskFormModal open={showCreate} onClose={() => setShowCreate(false)} />

      <TaskFormModal
        key={editingTask?._id || 'no-edit'}
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        task={editingTask}
      />
    </div>
  );
}