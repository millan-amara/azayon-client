import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Upload, MessageCircle, Phone, Mail, Sparkles, Check, X, AlertCircle, Trash2 } from 'lucide-react';
import { useContacts, useCreateContact, useDeleteContact, useTeam } from '@/hooks/useData';
import { useRole } from '@/hooks/useRole';
import { useAuth } from '@/context/AuthContext';
import { Button, Input, Select, Badge, Modal, EmptyState, Spinner, Card } from '@/components/ui';
import { CONTACT_STATUS_COLORS, formatDate, getWhatsAppUrl, cn } from '@/lib/utils';
import { usePlan } from '@/context/PlanContext';
import { UsageWarningBanner } from '@/components/PlanBanners';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import api from '@/lib/api';
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
  const [importing, setImporting] = useState(false);
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
    setImporting(true);
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
    } catch (err) {
      toast.error('Import failed — please try again');
      setStep('mapping');
    } finally {
      setImporting(false);
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
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    company: '', jobTitle: '', status: 'lead', assignedTo: '',
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    await mutateAsync(form);
    onClose();
    setForm({ firstName: '', lastName: '', email: '', phone: '', company: '', jobTitle: '', status: 'lead', assignedTo: '' });
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
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isPending}>Create contact</Button>
        </div>
      </form>
    </Modal>
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
  const { canWrite, role } = useRole();
  const { billing } = usePlan();

  const contacts = data?.contacts || [];
  const pagination = data?.pagination;
  const teamMembers = (teamData?.users || []).filter((u) => u.isActive !== false);

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
                  <tr key={c._id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors group">
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
        onImported={() => { setShowImport(false); window.location.reload(); }}
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