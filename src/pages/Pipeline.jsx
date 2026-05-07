import { useState, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, MessageCircle, MoreVertical, Trophy, XCircle, Filter, Download, Upload, Search, X, SlidersHorizontal, Sparkles, AlertCircle, Check } from 'lucide-react';
import Papa from 'papaparse';
import { callClaude } from '@/lib/ai';
import { useKanban, usePipelines, useUpdateDeal, useCreateDeal, useMarkDealWon, useMarkDealLost, useContacts, useTeam, useCustomFields } from '@/hooks/useData';
import { useQueryClient } from '@tanstack/react-query';
import { useRole } from '@/hooks/useRole';
import { useAuth } from '@/context/AuthContext';
import { Button, Modal, Input, Select, Textarea, Spinner, EmptyState, Card } from '@/components/ui';
import { formatCurrency, formatDate, getWhatsAppUrl, cn } from '@/lib/utils';
import api, { downloadFile } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import SavedViewSelector from '@/components/SavedViewSelector';

function DealCard({ deal, index, onWon, onLost }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const waUrl = deal.contact?.phone ? getWhatsAppUrl(deal.contact.phone) : null;

  // "Days in current stage" — find the open stageHistory entry (no exitedAt)
  // and diff against now. Falls back to createdAt for legacy deals that
  // existed before stageHistory was being written.
  const currentStageEntry = (deal.stageHistory || []).find((h) => !h.exitedAt);
  const enteredAt = currentStageEntry?.enteredAt || deal.createdAt;
  const daysInStage = enteredAt
    ? Math.floor((Date.now() - new Date(enteredAt).getTime()) / 86400000)
    : null;
  const stageAgeColor =
    daysInStage == null ? '' :
    daysInStage >= 21   ? 'text-red-500' :
    daysInStage >= 7    ? 'text-amber-600' :
                          'text-muted-foreground';

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
            <div className="flex items-center gap-2">
              {daysInStage != null && daysInStage > 0 && (
                <span
                  className={cn('text-[10px] font-medium tabular-nums', stageAgeColor)}
                  title={`In ${currentStageEntry?.stageName || 'this stage'} since ${formatDate(enteredAt)}`}
                >
                  {daysInStage}d
                </span>
              )}
              {deal.assignedTo && (
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary" title={deal.assignedTo.name}>
                  {deal.assignedTo.name?.[0] || '?'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

// ─── DEAL CSV IMPORT ─────────────────────────────────────────────────────────
// Same pattern as Contacts.jsx SmartImportModal: AI maps CSV headers to deal
// fields, user reviews, then we POST in bulk. Adds a setup step where the user
// picks the destination pipeline + default stage.

const DEAL_CRM_FIELDS = [
  { value: 'title',             label: 'Deal title' },
  { value: 'value',             label: 'Value (number)' },
  { value: 'currency',          label: 'Currency' },
  { value: 'contactName',       label: 'Contact name' },
  { value: 'contactEmail',      label: 'Contact email' },
  { value: 'contactPhone',      label: 'Contact phone' },
  { value: 'stageName',         label: 'Stage name (optional, falls back to default)' },
  { value: 'expectedCloseDate', label: 'Expected close date' },
  { value: 'notes',             label: 'Notes' },
  { value: '_skip',             label: '— Skip this column —' },
];

function SmartDealImportModal({ open, onClose, pipelines, defaultPipelineId, onImported }) {
  const [step, setStep] = useState('setup'); // setup | upload | mapping | importing | done
  const [pipelineId, setPipelineId] = useState(defaultPipelineId || pipelines?.[0]?._id || '');
  const [stageId, setStageId] = useState('');
  const [csvData, setCsvData] = useState(null);
  const [mapping, setMapping] = useState({});
  const [analysing, setAnalysing] = useState(false);
  const [result, setResult] = useState(null);

  const pipeline = pipelines?.find((p) => p._id === pipelineId);
  const openStages = (pipeline?.stages || []).filter((s) => !s.isWon && !s.isLost).sort((a, b) => a.order - b.order);

  // Default to the first open stage when pipeline changes
  useMemo(() => {
    if (!stageId && openStages.length > 0) setStageId(openStages[0]._id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineId]);

  const handleFile = async (file) => {
    if (!file) return;
    setAnalysing(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      preview: 5,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const previewRows = results.data;

        // Re-parse in full to import every row
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: async (full) => {
            setCsvData({ headers, rows: full.data, preview: previewRows });

            try {
              const sample = previewRows[0] || {};
              const sampleStr = headers.map((h) => `"${h}": "${sample[h] || ''}"`).join(', ');
              const text = await callClaude({
                systemPrompt: `You map CSV column headers to a CRM deal schema.
Available fields: title, value, currency, contactName, contactEmail, contactPhone, stageName, expectedCloseDate, notes.
Map every header to one of those fields, or "_skip" if it doesn't fit.
Reply with valid JSON only — no markdown, no commentary.`,
                userPrompt: `Headers: ${headers.join(', ')}
Sample row: {${sampleStr}}

Respond with: {"CSV Header": "field", ...}`,
                maxTokens: 300,
              });
              const clean = text.replace(/```json|```/g, '').trim();
              setMapping(JSON.parse(clean));
            } catch {
              const fallback = {};
              headers.forEach((h) => { fallback[h] = '_skip'; });
              setMapping(fallback);
              toast('Could not auto-map columns — please map manually', { icon: '⚠️' });
            } finally {
              setAnalysing(false);
              setStep('mapping');
            }
          },
        });
      },
    });
  };

  const previewDeals = (csvData?.preview || []).slice(0, 3).map((row) => {
    const d = {};
    Object.entries(mapping).forEach(([h, f]) => { if (f && f !== '_skip') d[f] = row[h]; });
    return d;
  });
  const mappedCount = Object.values(mapping).filter((v) => v && v !== '_skip').length;
  const titleMapped = Object.values(mapping).includes('title');

  const handleImport = async () => {
    setStep('importing');
    try {
      const deals = (csvData.rows || []).map((row) => {
        const d = {};
        Object.entries(mapping).forEach(([h, f]) => {
          if (f && f !== '_skip' && row[h] != null && row[h] !== '') d[f] = row[h];
        });
        return d;
      }).filter((d) => d.title); // server will skip these too, but fail fast

      const { data } = await api.post('/deals/import', { deals, pipelineId, defaultStageId: stageId });
      setResult(data);
      setStep('done');
      onImported?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed — please try again');
      setStep('mapping');
    }
  };

  const reset = () => {
    setStep('setup');
    setCsvData(null);
    setMapping({});
    setResult(null);
  };

  const handleClose = () => {
    onClose();
    setTimeout(reset, 300);
  };

  return (
    <Modal open={open} onClose={handleClose} title="Import deals" className="max-w-2xl">
      <div className="space-y-5">
        {step === 'setup' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pick where these deals should land. If your CSV has a "Stage" column we'll use that per-row, otherwise everything drops into the default stage.
            </p>
            <Select
              label="Pipeline"
              value={pipelineId}
              onChange={(e) => { setPipelineId(e.target.value); setStageId(''); }}
              options={pipelines.map((p) => ({ value: p._id, label: p.name }))}
            />
            <Select
              label="Default stage"
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              options={[
                { value: '', label: 'Select a stage…' },
                ...openStages.map((s) => ({ value: s._id, label: s.name })),
              ]}
            />
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>Cancel</Button>
              <Button className="flex-1" onClick={() => setStep('upload')} disabled={!pipelineId || !stageId}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 'upload' && !analysing && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">Drop a CSV file or click to browse</p>
              <p className="text-xs text-muted-foreground mb-4">Any column names work — AI will map them automatically</p>
              <label className="cursor-pointer">
                <input type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
                <Button variant="outline" size="sm" onClick={() => {}}>Choose CSV file</Button>
              </label>
            </div>
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-xs font-medium mb-1.5">Useful columns (any names):</p>
              <p className="text-xs text-muted-foreground font-mono">Deal name, Amount, Customer, Email, Stage, Close date…</p>
            </div>
          </div>
        )}

        {analysing && (
          <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/20">
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            <div>
              <p className="text-sm font-medium">Analysing your CSV...</p>
              <p className="text-xs text-muted-foreground">Claude is mapping your columns</p>
            </div>
          </div>
        )}

        {step === 'mapping' && csvData && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium">AI mapped {mappedCount} of {csvData.headers.length} columns</p>
              <p className="text-xs text-muted-foreground">— adjust any that look wrong</p>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {csvData.headers.map((header) => (
                <div key={header} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono truncate">{header}</p>
                    <p className="text-xs text-muted-foreground truncate">e.g. {csvData.preview?.[0]?.[header] || '—'}</p>
                  </div>
                  <div className="text-muted-foreground text-xs">→</div>
                  <select
                    value={mapping[header] || '_skip'}
                    onChange={(e) => setMapping((m) => ({ ...m, [header]: e.target.value }))}
                    className="h-8 px-2 rounded-lg border border-border bg-background text-xs focus-visible:outline-none"
                  >
                    {DEAL_CRM_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {previewDeals.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/40 px-3 py-2 border-b border-border">
                  <p className="text-xs font-medium">Preview (first 3 deals)</p>
                </div>
                <div className="divide-y divide-border">
                  {previewDeals.map((d, i) => (
                    <div key={i} className="px-3 py-2 text-xs">
                      <span className="font-medium">{d.title || '(no title — will be skipped)'}</span>
                      {d.value && <span className="text-muted-foreground ml-2">{formatCurrency(Number(d.value))}</span>}
                      {d.contactName && <span className="text-muted-foreground ml-2">· {d.contactName}</span>}
                      {d.stageName && <span className="text-muted-foreground ml-2">· {d.stageName}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700">
                {csvData.rows.length} rows found. {!titleMapped && 'Map a "Deal title" column or rows will be skipped. '}
                Contacts will be linked by email or auto-created if missing.
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button className="flex-1" onClick={handleImport} disabled={mappedCount === 0 || !titleMapped}>
                Import {csvData.rows.length} deals
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Spinner />
            <p className="text-sm font-medium">Importing deals...</p>
            <p className="text-xs text-muted-foreground">This may take a moment for large files</p>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-green-800">Import complete</p>
                <p className="text-sm text-green-700">{result.message}</p>
                {result.errors > 0 && (
                  <p className="text-xs text-amber-600 mt-0.5">{result.errors} row{result.errors === 1 ? '' : 's'} failed</p>
                )}
              </div>
            </div>
            <Button className="w-full" onClick={handleClose}>Done</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function CreateDealModal({ open, onClose, pipeline }) {
  const { mutateAsync, isPending } = useCreateDeal();
  const { data: contactsData } = useContacts({ limit: 100 });
  const { data: teamData } = useTeam();
  const { data: customFieldsData } = useCustomFields('deal');
  const customFields = customFieldsData?.fields || [];
  const [form, setForm] = useState({
    title: '', value: '', contactId: '', stageId: '', assignedTo: '',
    expectedCloseDate: '', notes: '',
  });
  const [customValues, setCustomValues] = useState({});

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setCustom = (key) => (e) => setCustomValues((v) => ({ ...v, [key]: e.target.value }));

  const openStages = pipeline?.stages?.filter((s) => !s.isWon && !s.isLost) || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.contactId) return toast.error('Please select a contact');
    if (!form.stageId) return toast.error('Please select a stage');
    for (const f of customFields) {
      if (f.required && !customValues[f.key]) {
        return toast.error(`${f.label} is required`);
      }
    }
    const payload = { ...form, pipelineId: pipeline._id, value: parseFloat(form.value) || 0 };
    if (customFields.length > 0) payload.customFields = customValues;
    await mutateAsync(payload);
    onClose();
    setForm({ title: '', value: '', contactId: '', stageId: '', assignedTo: '', expectedCloseDate: '', notes: '' });
    setCustomValues({});
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
  const [showImport, setShowImport] = useState(false);

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
  // Stable reference across renders when data hasn't changed — keeps deps quiet
  const kanban = useMemo(() => data?.kanban || [], [data]);
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

          <SavedViewSelector
            page="pipeline"
            currentFilters={{ assignedToFilter, filters }}
            onApply={(saved) => {
              if (saved.assignedToFilter !== undefined) setAssignedToFilter(saved.assignedToFilter);
              if (saved.filters) setFilters({ ...EMPTY_FILTERS, ...saved.filters });
            }}
          />

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
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)} title="Import deals from CSV">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import</span>
            </Button>
          )}
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
      <SmartDealImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        pipelines={pipelines}
        defaultPipelineId={pipelineId}
        onImported={() => {
          queryClient.invalidateQueries({ queryKey: ['kanban'] });
          queryClient.invalidateQueries({ queryKey: ['contacts'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        }}
      />
    </div>
  );
}