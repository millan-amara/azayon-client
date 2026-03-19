import { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, MessageCircle, MoreVertical, Trophy, XCircle } from 'lucide-react';
import { useKanban, usePipelines, useUpdateDeal, useCreateDeal, useMarkDealWon, useMarkDealLost, useContacts } from '@/hooks/useData';
import { useTeam } from '@/hooks/useData';
import { useQueryClient } from '@tanstack/react-query';
import { useRole } from '@/hooks/useRole';
import { Button, Modal, Input, Select, Textarea, Spinner, EmptyState, Card } from '@/components/ui';
import { formatCurrency, getWhatsAppUrl, cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

function DealCard({ deal, index, onWon, onLost }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const waUrl = deal.contact?.phone ? getWhatsAppUrl(deal.contact.phone) : null;

  return (
    <Draggable draggableId={deal._id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cn(
            'bg-background border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing transition-shadow',
            snapshot.isDragging && 'shadow-lg ring-2 ring-primary/20'
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-medium truncate hover:text-primary cursor-pointer transition-colors"
                onClick={(e) => { e.stopPropagation(); navigate(`/deals/${deal._id}`); }}
              >
                {deal.title}
              </p>
              {deal.contact && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {deal.contact.firstName} {deal.contact.lastName}
                  {deal.contact.company && ` · ${deal.contact.company}`}
                </p>
              )}
            </div>
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
                className="p-1 rounded hover:bg-muted transition-colors"
              >
                <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-6 w-36 bg-background border border-border rounded-lg shadow-lg z-20 py-1 text-sm overflow-hidden">
                    <button
                      onClick={() => { onWon(deal._id); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-green-600 transition-colors"
                    >
                      <Trophy className="w-3.5 h-3.5" /> Mark won
                    </button>
                    <button
                      onClick={() => { onLost(deal._id); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-red-500 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Mark lost
                    </button>
                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-green-600 transition-colors"
                        onClick={() => setMenuOpen(false)}
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs font-semibold text-primary">
              {formatCurrency(deal.value, deal.currency)}
            </span>
            {deal.assignedTo && (
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary" title={deal.assignedTo.name}>
                {deal.assignedTo.name?.[0] || '?'}
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}

function CreateDealModal({ open, onClose, pipeline }) {
  const { mutateAsync, isPending } = useCreateDeal();
  const { data: contactsData } = useContacts({ limit: 100 });
  const { data: teamData } = useTeam();
  const [form, setForm] = useState({
    title: '', value: '', contactId: '', stageId: '', assignedTo: '',
    expectedCloseDate: '', notes: '',
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openStages = pipeline?.stages?.filter((s) => !s.isWon && !s.isLost) || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.contactId) return toast.error('Please select a contact');
    if (!form.stageId) return toast.error('Please select a stage');
    await mutateAsync({ ...form, pipelineId: pipeline._id, value: parseFloat(form.value) || 0 });
    onClose();
    setForm({ title: '', value: '', contactId: '', stageId: '', assignedTo: '', expectedCloseDate: '', notes: '' });
  };

  return (
    <Modal open={open} onClose={onClose} title="New deal">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Deal title *" placeholder="e.g. Website redesign - Acme Ltd" value={form.title} onChange={set('title')} required />
        <Select
          label="Contact *"
          value={form.contactId}
          onChange={set('contactId')}
          options={[
            { value: '', label: 'Select contact...' },
            ...(contactsData?.contacts || []).map((c) => ({
              value: c._id,
              label: `${c.firstName} ${c.lastName}${c.company ? ` (${c.company})` : ''}`,
            })),
          ]}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Value (KES)" type="number" placeholder="0" value={form.value} onChange={set('value')} />
          <Select
            label="Stage *"
            value={form.stageId}
            onChange={set('stageId')}
            options={[
              { value: '', label: 'Select stage...' },
              ...openStages.map((s) => ({ value: s._id, label: s.name })),
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Expected close date" type="date" value={form.expectedCloseDate} onChange={set('expectedCloseDate')} />
          <Select
            label="Assign to"
            value={form.assignedTo}
            onChange={set('assignedTo')}
            options={[
              { value: '', label: 'Unassigned' },
              ...(teamData?.users || []).map((u) => ({ value: u._id, label: u.name })),
            ]}
          />
        </div>
        <Textarea label="Notes" value={form.notes} onChange={set('notes')} rows={2} />
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isPending}>Create deal</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function Pipeline() {
  const { data: pipelinesData, isLoading: loadingPipelines } = usePipelines();
  const [activePipelineId, setActivePipelineId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const { canWrite } = useRole();

  const pipelines = pipelinesData?.pipelines || [];
  const pipelineId = activePipelineId || pipelines[0]?._id;

  const { data, isLoading } = useKanban(pipelineId);
  const { mutate: updateDeal } = useUpdateDeal();
  const { mutate: markWon } = useMarkDealWon();
  const { mutate: markLost } = useMarkDealLost();

  const pipeline = data?.pipeline;
  const kanban = data?.kanban || [];

  const queryClient = useQueryClient();

  const onDragEnd = (result) => {
    if (!canWrite) return;
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const newStage = pipeline.stages.find((s) => s._id === destination.droppableId);
    if (!newStage) return;

    // Optimistic update — move the card in the cache instantly
    queryClient.setQueryData(['kanban', pipelineId], (old) => {
      if (!old) return old;
      const updated = {
        ...old,
        kanban: old.kanban.map((col) => {
          // Remove from source column
          if (col.stage._id === source.droppableId) {
            const deals = col.deals.filter((d) => d._id !== draggableId);
            return { ...col, deals, totalValue: deals.reduce((s, d) => s + (d.value || 0), 0) };
          }
          // Add to destination column
          if (col.stage._id === destination.droppableId) {
            const movingDeal = old.kanban
              .flatMap((c) => c.deals)
              .find((d) => d._id === draggableId);
            if (!movingDeal) return col;
            const deals = [...col.deals, { ...movingDeal, stageId: newStage._id, stageName: newStage.name }];
            return { ...col, deals, totalValue: deals.reduce((s, d) => s + (d.value || 0), 0) };
          }
          return col;
        }),
      };
      return updated;
    });

    // Fire API call in background
    updateDeal({ id: draggableId, stageId: newStage._id });
  };

  if (loadingPipelines || isLoading) return (
    <div className="flex justify-center py-20"><Spinner /></div>
  );

  return (
    <div className="space-y-4 h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {pipelines.map((p) => (
            <button
              key={p._id}
              onClick={() => setActivePipelineId(p._id)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg font-medium transition-colors',
                pipelineId === p._id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
        {canWrite && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> New deal
          </Button>
        )}
      </div>

      {/* Pipeline summary */}
      {pipeline && (
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{kanban.reduce((s, col) => s + col.deals.length, 0)} open deals</span>
          <span>·</span>
          <span>{formatCurrency(kanban.reduce((s, col) => s + col.totalValue, 0))} total value</span>
        </div>
      )}

      {/* Kanban board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 kanban-scroll -mx-6 px-6">
          {kanban.map(({ stage, deals, totalValue }) => (
            <div key={stage._id} className="flex-shrink-0 w-64">
              {/* Column header */}
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span className="text-xs font-semibold uppercase tracking-wide">{stage.name}</span>
                  <span className="text-xs text-muted-foreground bg-muted rounded-full w-5 h-5 flex items-center justify-center">
                    {deals.length}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{formatCurrency(totalValue)}</span>
              </div>

              {/* Cards */}
              <Droppable droppableId={stage._id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'min-h-24 rounded-xl p-2 space-y-2 transition-colors',
                      snapshot.isDraggingOver ? 'bg-primary/5 border-2 border-dashed border-primary/30' : 'bg-muted/40'
                    )}
                  >
                    {deals.map((deal, i) => (
                      <DealCard
                        key={deal._id}
                        deal={deal}
                        index={i}
                        onWon={(id) => markWon(id)}
                        onLost={(id) => markLost({ id, reason: '' })}
                      />
                    ))}
                    {provided.placeholder}
                    {deals.length === 0 && !snapshot.isDraggingOver && (
                      <p className="text-xs text-muted-foreground text-center py-4">Drop here</p>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      <CreateDealModal open={showCreate} onClose={() => setShowCreate(false)} pipeline={pipeline} />
    </div>
  );
}