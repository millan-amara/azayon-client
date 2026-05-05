import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Upload, Download, MessageCircle, Phone, Mail, Sparkles, Check, X, AlertCircle, Trash2, UserPlus, Tag as TagIcon, Archive } from 'lucide-react';
import { useContacts, useCreateContact, useDeleteContact, useTeam, useBulkUpdateContacts, useContactTags, useCustomFields } from '@/hooks/useData';
import { useQueryClient } from '@tanstack/react-query';
import { useRole } from '@/hooks/useRole';
import { useAuth } from '@/context/AuthContext';
import { Button, Input, Select, Badge, Modal, EmptyState, Spinner, Card } from '@/components/ui';
import { CONTACT_STATUS_COLORS, formatDate, getWhatsAppUrl, cn } from '@/lib/utils';
import { usePlan } from '@/context/PlanContext';
import { UsageWarningBanner } from '@/components/PlanBanners';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import api, { downloadFile } from '@/lib/api';
import { callClaude } from '@/lib/ai';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'lead', label: 'Lead' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'customer', label: 'Customer' },
  { value: 'churned', label: 'Churned' },
];

// CRM fields that CSV columns can map to
const CRM_FIELDS = [
  { value: 'firstName', label: 'First name' },
  { value: 'lastName', label: 'Last name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'company', label: 'Company' },
  { value: 'jobTitle', label: 'Job title' },
  { value: 'city', label: 'City' },
  { value: 'notes', label: 'Notes' },
  { value: '_skip', label: '— Skip this column —' },
];

function SmartImportModal({ open, onClose, onImported }) {
  const [step, setStep] = useState('upload'); // upload | mapping | importing | done
  const [csvData, setCsvData] = useState(null); // { headers, rows }
  const [mapping, setMapping] = useState({}); // { csvHeader: crmField }
  const [analysing, setAnalysing] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    setAnalysing(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      preview: 5, // only parse first 5 rows for preview
      complete: async (results) => {
        const headers = results.meta.fields || [];
        const rows = results.data;

        // Re-parse full file
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: async (fullResults) => {
            const fullRows = fullResults.data;
            setCsvData({ headers, rows: fullRows, preview: rows });

            // Ask Claude to map the columns
            try {
              const sampleRow = rows[0] || {};
              const sampleData = headers.map((h) => `"${h}": "${sampleRow[h] || ''}"`).join(', ');

              const result = await callClaude({
                systemPrompt: `You are a data mapping assistant. Map CSV column headers to CRM fields.
Available CRM fields: firstName, lastName, email, phone, company, jobTitle, city, notes.
If a column does not match any field, map it to "_skip".
Respond ONLY with a valid JSON object mapping CSV headers to CRM fields. No explanation, no markdown.`,
                userPrompt: `Map these CSV columns to CRM fields:
Headers: ${headers.join(', ')}
Sample row: {${sampleData}}

Respond with JSON only: {"CSV Header": "crmField", ...}`,
                maxTokens: 300,
              });

              // Parse JSON from Claude
              const clean = result.replace(/```json|```/g, '').trim();
              const mapped = JSON.parse(clean);
              setMapping(mapped);
            } catch {
              // Fallback to basic mapping if AI fails
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

  const handleImport = async () => {
    setStep('importing');

    try {
      const contacts = (csvData.rows || []).map((row) => {
        const contact = {};
        Object.entries(mapping).forEach(([csvHeader, crmField]) => {
          if (crmField && crmField !== '_skip' && row[csvHeader]) {
            contact[crmField] = row[csvHeader];
          }
        });
        return contact;
      }).filter((c) => c.firstName || c.email); // need at least a name or email

      const { data } = await api.post('/contacts/import', { contacts });
      setImportResult(data);
      setStep('done');
      onImported?.();
    } catch {
      toast.error('Import failed — please try again');
      setStep('mapping');
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => { setStep('upload'); setCsvData(null); setMapping({}); setImportResult(null); }, 300);
  };

  const mappedCount = Object.values(mapping).filter((v) => v && v !== '_skip').length;
  const previewContacts = (csvData?.preview || []).slice(0, 3).map((row) => {
    const c = {};
    Object.entries(mapping).forEach(([h, f]) => { if (f && f !== '_skip') c[f] = row[h]; });
    return c;
  });

  return (
    <Modal open={open} onClose={handleClose} title="Import contacts" className="max-w-2xl">
      <div className="space-y-5">

        {/* UPLOAD STEP */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">Drop a CSV file or click to browse</p>
              <p className="text-xs text-muted-foreground mb-4">Any column names work — AI will map them automatically</p>
              <label className="cursor-pointer">
                <input type="file" accept=".csv" className="hidden"
                  onChange={(e) => handleFile(e.target.files[0])} />
                <Button variant="outline" size="sm" onClick={() => {}}>Choose CSV file</Button>
              </label>
            </div>
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-xs font-medium mb-1.5">Your CSV can have any column names, for example:</p>
              <p className="text-xs text-muted-foreground font-mono">Name, Phone No., Biz, Email Address, Position...</p>
              <p className="text-xs text-muted-foreground mt-1">Claude will figure out what maps to what.</p>
            </div>
          </div>
        )}

        {/* ANALYSING */}
        {(step === 'upload' && analysing) && (
          <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/20">
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            <div>
              <p className="text-sm font-medium">Analysing your CSV...</p>
              <p className="text-xs text-muted-foreground">Claude is mapping your columns to CRM fields</p>
            </div>
          </div>
        )}

        {/* MAPPING STEP */}
        {step === 'mapping' && csvData && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium">AI mapped {mappedCount} of {csvData.headers.length} columns</p>
              <p className="text-xs text-muted-foreground">— adjust any that look wrong</p>
            </div>

            {/* Column mapping */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {csvData.headers.map((header) => (
                <div key={header} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono truncate">{header}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      e.g. {csvData.preview?.[0]?.[header] || '—'}
                    </p>
                  </div>
                  <div className="text-muted-foreground text-xs">→</div>
                  <select
                    value={mapping[header] || '_skip'}
                    onChange={(e) => setMapping((m) => ({ ...m, [header]: e.target.value }))}
                    className="h-8 px-2 rounded-lg border border-border bg-background text-xs focus-visible:outline-none"
                  >
                    {CRM_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* Preview */}
            {previewContacts.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/40 px-3 py-2 border-b border-border">
                  <p className="text-xs font-medium">Preview (first 3 contacts)</p>
                </div>
                <div className="divide-y divide-border">
                  {previewContacts.map((c, i) => (
                    <div key={i} className="px-3 py-2 text-xs">
                      <span className="font-medium">{[c.firstName, c.lastName].filter(Boolean).join(' ') || '(no name)'}</span>
                      {c.email && <span className="text-muted-foreground ml-2">{c.email}</span>}
                      {c.phone && <span className="text-muted-foreground ml-2">{c.phone}</span>}
                      {c.company && <span className="text-muted-foreground ml-2">· {c.company}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700">
                {csvData.rows.length} contacts found. Only rows with a first name or email will be imported.
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button className="flex-1" onClick={handleImport} disabled={mappedCount === 0}>
                Import {csvData.rows.length} contacts
              </Button>
            </div>
          </div>
        )}

        {/* IMPORTING */}
        {step === 'importing' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Spinner />
            <p className="text-sm font-medium">Importing contacts...</p>
            <p className="text-xs text-muted-foreground">This may take a moment</p>
          </div>
        )}

        {/* DONE */}
        {step === 'done' && importResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-green-800">Import complete</p>
                <p className="text-sm text-green-700">{importResult.imported} contacts imported successfully</p>
                {importResult.errors > 0 && (
                  <p className="text-xs text-amber-600 mt-0.5">{importResult.errors} rows skipped due to errors</p>
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

function CreateContactModal({ open, onClose }) {
  const { mutateAsync, isPending } = useCreateContact();
  const { data: teamData } = useTeam();
  const { data: customFieldsData } = useCustomFields('contact');
  const customFields = customFieldsData?.fields || [];

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    company: '', jobTitle: '', status: 'lead', assignedTo: '',
  });
  const [customValues, setCustomValues] = useState({});

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setCustom = (key) => (e) => setCustomValues((v) => ({ ...v, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validate required custom fields
    for (const f of customFields) {
      if (f.required && !customValues[f.key]) {
        toast.error(`${f.label} is required`);
        return;
      }
    }
    const payload = { ...form };
    if (Object.keys(customValues).length > 0) {
      payload.customFields = customValues;
    }
    await mutateAsync(payload);
    onClose();
    setForm({ firstName: '', lastName: '', email: '', phone: '', company: '', jobTitle: '', status: 'lead', assignedTo: '' });
    setCustomValues({});
  };

  return (
    <Modal open={open} onClose={onClose} title="Add contact">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="First name *" value={form.firstName} onChange={set('firstName')} required />
          <Input label="Last name" value={form.lastName} onChange={set('lastName')} />
        </div>
        <Input label="Email" type="email" value={form.email} onChange={set('email')} />
        <Input label="Phone (with country code)" placeholder="+254712345678" value={form.phone} onChange={set('phone')} />
        <Input label="Company" value={form.company} onChange={set('company')} />
        <Input label="Job title" value={form.jobTitle} onChange={set('jobTitle')} />
        <Select
          label="Status"
          value={form.status}
          onChange={set('status')}
          options={STATUS_OPTIONS.slice(1)}
        />
        <Select
          label="Assign to"
          value={form.assignedTo}
          onChange={set('assignedTo')}
          options={[
            { value: '', label: 'Unassigned' },
            ...(teamData?.users || []).map((u) => ({ value: u._id, label: u.name })),
          ]}
        />

        {/* Custom fields */}
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
          <Button type="submit" className="flex-1" loading={isPending}>Create contact</Button>
        </div>
      </form>
    </Modal>
  );
}

function BulkActionsBar({ selectedIds, teamMembers, onClear, onDone }) {
  const { mutateAsync, isPending } = useBulkUpdateContacts();
  const { data: tagsData } = useContactTags();
  const [openMenu, setOpenMenu] = useState(null); // 'assign' | 'tag' | null
  const [newTag, setNewTag] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);

  const ids = [...selectedIds];
  const count = ids.length;
  if (count === 0) return null;

  const close = () => setOpenMenu(null);

  const apply = async (action, payload) => {
    await mutateAsync({ ids, action, payload });
    close();
    setNewTag('');
    onDone?.();
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/20">
        <span className="text-sm font-medium text-primary">
          {count} selected
        </span>
        <span className="text-muted-foreground">·</span>

        {/* Assign */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpenMenu(openMenu === 'assign' ? null : 'assign')}
          >
            <UserPlus className="w-3.5 h-3.5" /> Assign
          </Button>
          {openMenu === 'assign' && (
            <>
              <div className="fixed inset-0 z-10" onClick={close} />
              <div className="absolute left-0 top-9 w-48 bg-background border border-border rounded-lg shadow-lg z-20 py-1 max-h-64 overflow-y-auto">
                <button
                  onClick={() => apply('assign', { assignedTo: null })}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  Unassigned
                </button>
                <div className="my-1 border-t border-border" />
                {teamMembers.map((m) => (
                  <button
                    key={m._id}
                    onClick={() => apply('assign', { assignedTo: m._id })}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Add tag */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpenMenu(openMenu === 'tag' ? null : 'tag')}
          >
            <TagIcon className="w-3.5 h-3.5" /> Add tag
          </Button>
          {openMenu === 'tag' && (
            <>
              <div className="fixed inset-0 z-10" onClick={close} />
              <div className="absolute left-0 top-9 w-64 bg-background border border-border rounded-lg shadow-lg z-20 p-3 space-y-2">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newTag.trim()) apply('addTag', { tag: newTag.trim() });
                  }}
                  className="flex gap-1"
                >
                  <input
                    autoFocus
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="New tag…"
                    className="h-8 flex-1 min-w-0 px-2 rounded-lg border border-border bg-background text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <Button type="submit" size="sm" disabled={!newTag.trim()}>Add</Button>
                </form>
                {tagsData?.tags?.length > 0 && (
                  <>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mt-1">Existing tags</p>
                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                      {tagsData.tags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => apply('addTag', { tag })}
                          className="px-2 py-0.5 text-xs rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Archive */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirmArchive(true)}
          className="text-red-600 hover:bg-red-50 hover:border-red-200"
        >
          <Archive className="w-3.5 h-3.5" /> Archive
        </Button>

        <div className="ml-auto">
          <button
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-foreground underline"
            disabled={isPending}
          >
            Clear selection
          </button>
        </div>
      </div>

      <Modal
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        title={`Archive ${count} contact${count === 1 ? '' : 's'}?`}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Selected contacts will be removed from your list. Their deals and tasks stay in place. This cannot be undone from the UI.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmArchive(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
              loading={isPending}
              onClick={async () => {
                await apply('archive');
                setConfirmArchive(false);
              }}
            >
              Yes, archive
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default function Contacts() {
  const [showImport, setShowImport] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [page, setPage] = useState(1);
  const { user } = useAuth();

  const { data, isLoading } = useContacts({ search, status, assignedTo, page, limit: 25 });
  const { data: teamData } = useTeam();
  const { mutate: deleteContact } = useDeleteContact();
  const [deletingContact, setDeletingContact] = useState(null);
  const { canWrite } = useRole();
  const { billing } = usePlan();
  const queryClient = useQueryClient();

  const contacts = data?.contacts || [];
  const pagination = data?.pagination;
  const teamMembers = (teamData?.users || []).filter((u) => u.isActive !== false);
  const [exporting, setExporting] = useState(false);

  // Bulk selection — clears on filter or page change
  const [selected, setSelected] = useState(() => new Set());
  useEffect(() => { setSelected(new Set()); }, [search, status, assignedTo, page]);

  const visibleIds = contacts.map((c) => c._id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someVisibleSelected = !allVisibleSelected && visibleIds.some((id) => selected.has(id));

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadFile('/contacts/export', {
        params: { search: search || undefined, status: status || undefined, assignedTo: assignedTo || undefined },
      });
    } catch {
      toast.error('Export failed — please try again');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-6xl">
      {billing && !billing.hasFullAccess && billing.limits?.maxContacts < 999999 && pagination?.total > 0 && (
        <UsageWarningBanner
          type="contacts"
          current={pagination.total}
          limit={billing.limits.maxContacts}
        />
      )}
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="h-9 px-3 rounded-lg border border-border bg-background text-sm focus-visible:outline-none flex-1 sm:flex-none"
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={assignedTo}
            onChange={(e) => { setAssignedTo(e.target.value); setPage(1); }}
            className="h-9 px-3 rounded-lg border border-border bg-background text-sm focus-visible:outline-none flex-1 sm:flex-none"
          >
            <option value="">All contacts</option>
            <option value={user?._id}>My contacts</option>
            {teamMembers.filter((m) => m._id !== user?._id).map((m) => (
              <option key={m._id} value={m._id}>{m.name}</option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            loading={exporting}
            disabled={!contacts.length && !exporting}
            title="Download visible contacts as CSV"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          {canWrite && (
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import</span>
            </Button>
          )}
          {canWrite && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add contact</span>
            </Button>
          )}
        </div>
      </div>

      {/* Bulk actions */}
      {canWrite && (
        <BulkActionsBar
          selectedIds={selected}
          teamMembers={teamMembers}
          onClear={clearSelection}
          onDone={clearSelection}
        />
      )}

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : contacts.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No contacts found"
            description={search ? 'Try a different search term' : 'Add your first contact to get started'}
            action={canWrite ? <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" />Add contact</Button> : null}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {canWrite && (
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label="Select all visible contacts"
                        checked={allVisibleSelected}
                        ref={(el) => { if (el) el.indeterminate = someVisibleSelected; }}
                        onChange={toggleAllVisible}
                        className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Company</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Contact</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Added</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr
                    key={c._id}
                    className={cn(
                      'border-b border-border last:border-0 hover:bg-muted/30 transition-colors group',
                      selected.has(c._id) && 'bg-primary/5'
                    )}
                  >
                    {canWrite && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${c.firstName} ${c.lastName}`}
                          checked={selected.has(c._id)}
                          onChange={() => toggleOne(c._id)}
                          className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <Link to={`/contacts/${c._id}`} className="flex items-center gap-3 group">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                          {(c.firstName?.[0] || '') + (c.lastName?.[0] || '')}
                        </div>
                        <div>
                          <p className="font-medium group-hover:text-primary transition-colors">{c.firstName} {c.lastName}</p>
                          <p className="text-xs text-muted-foreground">{c.email}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{c.company || '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        {c.phone && (
                          <a
                            href={getWhatsAppUrl(c.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                            title="Chat on WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', CONTACT_STATUS_COLORS[c.status])}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link to={`/contacts/${c._id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                        {canWrite && (
                          <button
                            onClick={() => setDeletingContact(c)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-100 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                            title="Archive contact"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      <CreateContactModal open={showCreate} onClose={() => setShowCreate(false)} />
      <SmartImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => {
          setShowImport(false);
          setPage(1);
          queryClient.invalidateQueries({ queryKey: ['contacts'] });
          queryClient.invalidateQueries({ queryKey: ['contact-tags'] });
        }}
      />

      {/* Delete confirmation */}
      <Modal open={!!deletingContact} onClose={() => setDeletingContact(null)} title="Archive contact">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to archive <strong>{deletingContact?.firstName} {deletingContact?.lastName}</strong>?
            They will be removed from your contacts list. Their deals and tasks will be kept.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeletingContact(null)}>Cancel</Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
              onClick={() => {
                deleteContact(deletingContact._id);
                setDeletingContact(null);
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