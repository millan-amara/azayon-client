import { useState, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, MessageCircle, MoreVertical, Trophy, XCircle, Filter, Download, Search, X, SlidersHorizontal } from 'lucide-react';
import { useKanban, usePipelines, useUpdateDeal, useCreateDeal, useMarkDealWon, useMarkDealLost, useContacts, useTeam } from '@/hooks/useData';
import { useQueryClient } from '@tanstack/react-query';
import { useRole } from '@/hooks/useRole';
import { useAuth } from '@/context/AuthContext';
import { Button, Modal, Input, Select, Textarea, Spinner, EmptyState, Card } from '@/components/ui';
import { formatCurrency, getWhatsAppUrl, cn } from '@/lib/utils';
import { downloadFile } from '@/lib/api';
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

function FilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
      {label}
      <button
        onClick={onRemove}
        className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
        aria-label={`Remove filter ${label}`}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

export default function Pipeline() {
  const { data: pipelinesData, isLoading: loadingPipelines } = usePipelines();
  const { data: teamData } = useTeam();
  const { user } = useAuth();
  const { canWrite, role } = useRole();
  const [activePipelineId, setActivePipelineId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  // Sales reps default to seeing their own deals
  const defaultFilter = role === 'sales_rep' ? user?._id || '' : '';
  const [assignedToFilter, setAssignedToFilter] = useState(defaultFilter);
  const [exporting, setExporting] = useState(false);

  // Client-side filters applied to the kanban data
  const EMPTY_FILTERS = { search: '', minValue: '', maxValue: '', tags: [], closeDate: 'any' };
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const pipelines = pipelinesData?.pipelines || [];
  const pipelineId = activePipelineId || pipelines[0]?._id;

  const { data, isLoading } = useKanban(pipelineId, assignedToFilter);
  const { mutate: updateDeal } = useUpdateDeal();
  const { mutate: markWon } = useMarkDealWon();
  const { mutate: markLost } = useMarkDealLost();

  const pipeline = data?.pipeline;
  const kanban = data?.kanban || [];
  const teamMembers = (teamData?.users || []).filter((u) => u.isActive !== false);

  const queryClient = useQueryClient();

  // ─── Client-side filtering ─────────────────────────────────────────────────
  const availableTags = useMemo(() => {
    const set = new Set();
    kanban.forEach((col) => col.deals.forEach((d) => (d.tags || []).forEach((t) => set.add(t))));
    return [...set].sort();
  }, [kanban]);

  const activeFilterCount =
    (filters.search ? 1 : 0) +
    (filters.minValue !== '' ? 1 : 0) +
    (filters.maxValue !== '' ? 1 : 0) +
    (filters.tags.length > 0 ? 1 : 0) +
    (filters.closeDate !== 'any' ? 1 : 0);

  const filteredKanban = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const min = filters.minValue !== '' ? Number(filters.minValue) : null;
    const max = filters.maxValue !== '' ? Number(filters.maxValue) : null;
    const tagSet = new Set(filters.tags);

    // Date windows in local time
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfWeek = new Date(startOfToday);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const matchesDate = (deal) => {
      if (filters.closeDate === 'any') return true;
      const d = deal.expectedCloseDate ? new Date(deal.expectedCloseDate) : null;
      switch (filters.closeDate) {
        case 'overdue':   return d && d < startOfToday;
        case 'thisWeek':  return d && d >= startOfToday && d <= endOfWeek;
        case 'thisMonth': return d && d >= startOfToday && d <= endOfMonth;
        case 'none':      return !d;
        default: return true;
      }
    };

    const matches = (deal) => {
      if (search) {
        const hay = [
          deal.title,
          deal.contact?.firstName, deal.contact?.lastName, deal.contact?.company,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(search)) return false;
      }
      const v = deal.value || 0;
      if (min !== null && v < min) return false;
      if (max !== null && v > max) return false;
      if (tagSet.size > 0 && !(deal.tags || []).some((t) => tagSet.has(t))) return false;
      if (!matchesDate(deal)) return false;
      return true;
    };

    return kanban.map((col) => {
      const deals = col.deals.filter(matches);
      return {
        ...col,
        deals,
        totalValue: deals.reduce((s, d) => s + (d.value || 0), 0),
      };
    });
  }, [kanban, filters]);

  const totalDeals = filteredKanban.reduce((s, col) => s + col.deals.length, 0);
  const totalValue = filteredKanban.reduce((s, col) => s + col.totalValue, 0);

  const toggleTag = (tag) => {
    setFilters((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }));
  };

  const clearFilters = () => setFilters(EMPTY_FILTERS);

  const handleExport = async () => {
    if (!pipelineId) return;
    setExporting(true);
    try {
      await downloadFile('/deals/export', {
        params: {
          pipelineId,
          status: 'open',
          assignedTo: assignedToFilter || undefined,
        },
      });
    } catch {
      toast.error('Export failed — please try again');
    } finally {
      setExporting(false);
    }
  };

  const onDragEnd = (result) => {
    if (!canWrite) return;
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const newStage = pipeline.stages.find((s) => s._id === destination.droppableId);
    if (!newStage) return;

    // Optimistic update — move the card in the cache instantly
    queryClient.setQueryData(['kanban', pipelineId, assignedToFilter], (old) => {
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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {pipelines.map((p) => (
            <button
              key={p._id}
              onClick={() => setActivePipelineId(p._id)}
              className={cn(
                'px-3 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-colors',
                pipelineId === p._id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="search"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Search deals…"
              className="h-8 w-40 sm:w-48 pl-8 pr-2 rounded-lg border border-border bg-background text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <select
              value={assignedToFilter}
              onChange={(e) => setAssignedToFilter(e.target.value)}
              className="h-8 px-2 pr-7 rounded-lg border border-border bg-background text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-w-32 sm:max-w-none"
            >
              <option value="">All deals</option>
              <option value={user?._id}>My deals</option>
              {teamMembers
                .filter((m) => m._id !== user?._id)
                .map((m) => (
                  <option key={m._id} value={m._id}>{m.name}</option>
                ))}
            </select>
          </div>

          {/* More filters popover */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen((o) => !o)}
              className={cn(activeFilterCount > 0 && 'border-primary text-primary')}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-primary text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            {filtersOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setFiltersOpen(false)} />
                <div className="absolute right-0 top-10 w-72 bg-background border border-border rounded-xl shadow-lg z-20 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Filter deals</span>
                    {activeFilterCount > 0 && (
                      <button onClick={clearFilters} className="text-xs text-primary hover:underline">
                        Clear all
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5">Value range</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder="Min"
                        value={filters.minValue}
                        onChange={(e) => setFilters((f) => ({ ...f, minValue: e.target.value }))}
                        className="h-8 flex-1 min-w-0 px-2 rounded-lg border border-border bg-background text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                      <span className="text-muted-foreground text-xs self-center">to</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder="Max"
                        value={filters.maxValue}
                        onChange={(e) => setFilters((f) => ({ ...f, maxValue: e.target.value }))}
                        className="h-8 flex-1 min-w-0 px-2 rounded-lg border border-border bg-background text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5">Expected close</label>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { value: 'any',       label: 'Any' },
                        { value: 'overdue',   label: 'Overdue' },
                        { value: 'thisWeek',  label: 'This week' },
                        { value: 'thisMonth', label: 'This month' },
                        { value: 'none',      label: 'No date' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setFilters((f) => ({ ...f, closeDate: opt.value }))}
                          className={cn(
                            'px-2 py-1.5 text-xs rounded-lg border transition-colors',
                            filters.closeDate === opt.value
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background border-border text-muted-foreground hover:border-primary/40'
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5">
                      Tags {availableTags.length === 0 && <span className="text-muted-foreground font-normal">(none on these deals)</span>}
                    </label>
                    {availableTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                        {availableTags.map((tag) => {
                          const active = filters.tags.includes(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => toggleTag(tag)}
                              className={cn(
                                'px-2 py-0.5 text-xs rounded-full border transition-colors',
                                active
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-background border-border text-muted-foreground hover:border-primary/40'
                              )}
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            loading={exporting}
            disabled={!pipelineId}
            title="Download open deals in this pipeline as CSV"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          {canWrite && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New deal</span>
            </Button>
          )}
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {filters.search && (
            <FilterChip label={`"${filters.search}"`} onRemove={() => setFilters((f) => ({ ...f, search: '' }))} />
          )}
          {filters.minValue !== '' && (
            <FilterChip label={`≥ ${formatCurrency(Number(filters.minValue))}`} onRemove={() => setFilters((f) => ({ ...f, minValue: '' }))} />
          )}
          {filters.maxValue !== '' && (
            <FilterChip label={`≤ ${formatCurrency(Number(filters.maxValue))}`} onRemove={() => setFilters((f) => ({ ...f, maxValue: '' }))} />
          )}
          {filters.tags.map((tag) => (
            <FilterChip key={tag} label={`#${tag}`} onRemove={() => toggleTag(tag)} />
          ))}
          {filters.closeDate !== 'any' && (
            <FilterChip
              label={{ overdue: 'Overdue', thisWeek: 'Closes this week', thisMonth: 'Closes this month', none: 'No close date' }[filters.closeDate]}
              onRemove={() => setFilters((f) => ({ ...f, closeDate: 'any' }))}
            />
          )}
          <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground underline ml-1">
            Clear all
          </button>
        </div>
      )}

      {/* Pipeline summary */}
      {pipeline && (
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>
            {totalDeals} {totalDeals === 1 ? 'deal' : 'deals'}
            {activeFilterCount > 0 && (
              <span className="text-muted-foreground/60"> of {kanban.reduce((s, col) => s + col.deals.length, 0)}</span>
            )}
          </span>
          <span>·</span>
          <span>{formatCurrency(totalValue)} total value</span>
        </div>
      )}

      {/* Kanban board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 kanban-scroll -mx-6 px-6">
          {filteredKanban.map(({ stage, deals, totalValue }) => (
            <div key={stage._id} className="shrink-0 w-64">
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