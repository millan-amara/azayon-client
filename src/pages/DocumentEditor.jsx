import { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Send, Download, CheckCircle2, MessageCircle,
  XCircle, FileText, Mail,
} from 'lucide-react';
import {
  useDocument, useCreateDocument, useUpdateDocument,
  useSendDocument, useMarkDocumentPaid, useAcceptQuote, useDeclineQuote,
  useContacts, useEmailTemplates,
} from '@/hooks/useData';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/hooks/useRole';
import { Button, Card, Input, Select, Textarea, Modal, Spinner } from '@/components/ui';
import { downloadFile } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  draft:     'bg-gray-100 text-gray-700',
  sent:      'bg-blue-100 text-blue-700',
  viewed:    'bg-amber-100 text-amber-700',
  paid:      'bg-green-100 text-green-700',
  overdue:   'bg-red-100 text-red-700',
  accepted:  'bg-green-100 text-green-700',
  declined:  'bg-red-100 text-red-700',
  expired:   'bg-gray-100 text-gray-600',
  cancelled: 'bg-gray-100 text-gray-500',
};

function emptyItem() {
  return { description: '', quantity: 1, unitPrice: 0, amount: 0 };
}

function buildItemsFromDoc(doc) {
  if (!doc?.items?.length) return [emptyItem()];
  return doc.items.map((it) => ({
    description: it.description || '',
    quantity:    Number(it.quantity)  || 1,
    unitPrice:   Number(it.unitPrice) || 0,
    amount:      Number(it.amount)    || 0,
    _id:         it._id,
  }));
}

// ─── EDITOR (draft mode) ──────────────────────────────────────────────────────

function EditMode({ doc, type, contactIdParam, onSaved }) {
  const navigate = useNavigate();
  const { org } = useAuth();
  const { data: contactsData } = useContacts({ limit: 200 });
  const { mutateAsync: createDoc, isPending: creating } = useCreateDocument();
  const { mutateAsync: updateDoc, isPending: updating } = useUpdateDocument();

  const isNew = !doc;
  const contacts = contactsData?.contacts || [];

  const [contactId, setContactId] = useState(doc?.contact?._id || doc?.contact || contactIdParam || '');
  const [items, setItems]         = useState(() => buildItemsFromDoc(doc));
  const [taxRate, setTaxRate]     = useState(doc?.taxRate || 0);
  const [currency, setCurrency]   = useState(doc?.currency || org?.settings?.currency || 'KES');
  const [dueDate, setDueDate]     = useState(doc?.dueDate ? new Date(doc.dueDate).toISOString().slice(0, 10) : '');
  const [notes, setNotes]         = useState(doc?.notes || '');
  const [internalNotes, setInternalNotes] = useState(doc?.internalNotes || '');

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
    const taxAmount = subtotal * (Number(taxRate) || 0) / 100;
    return { subtotal, taxAmount, total: subtotal + taxAmount };
  }, [items, taxRate]);

  const updateItem = (idx, field, value) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };
  const addItem    = () => setItems((p) => [...p, emptyItem()]);
  const removeItem = (idx) => setItems((p) => p.length > 1 ? p.filter((_, i) => i !== idx) : p);

  const handleSave = async (close = false) => {
    if (!contactId) return toast.error('Pick a contact');
    if (items.length === 0 || items.every((it) => !it.description.trim())) {
      return toast.error('Add at least one line item');
    }

    const cleanItems = items
      .filter((it) => it.description.trim())
      .map((it) => ({
        description: it.description.trim(),
        quantity:  Number(it.quantity)  || 0,
        unitPrice: Number(it.unitPrice) || 0,
      }));

    const payload = {
      type,
      contactId,
      items: cleanItems,
      taxRate: Number(taxRate) || 0,
      currency,
      dueDate: dueDate || undefined,
      notes,
      internalNotes,
    };

    let saved;
    if (isNew) {
      const data = await createDoc(payload);
      saved = data?.document;
    } else {
      const data = await updateDoc({ id: doc._id, ...payload });
      saved = data?.document;
    }

    if (close && saved) navigate(`/documents/${saved._id}`);
    else if (saved) onSaved?.(saved);
  };

  const heading = isNew ? `New ${type}` : `${doc.number} · Draft`;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Link to="/documents" className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-lg font-semibold">{heading}</h1>
          {!isNew && (
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', STATUS_COLORS.draft)}>
              draft
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/documents')}>Cancel</Button>
          <Button size="sm" onClick={() => handleSave(true)} loading={creating || updating}>
            {isNew ? 'Save draft' : 'Save changes'}
          </Button>
        </div>
      </div>

      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Customer *"
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            options={[
              { value: '', label: 'Select contact…' },
              ...contacts.map((c) => ({
                value: c._id,
                label: `${[c.firstName, c.lastName].filter(Boolean).join(' ')}${c.company ? ` (${c.company})` : ''}`,
              })),
            ]}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label={type === 'invoice' ? 'Due date' : 'Valid until'}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <Input
              label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 6))}
            />
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Line items</h3>
          <Button variant="outline" size="sm" onClick={addItem}><Plus className="w-3.5 h-3.5" /> Add row</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                <th className="py-2 pr-2">Description</th>
                <th className="py-2 px-2 w-20 text-right">Qty</th>
                <th className="py-2 px-2 w-32 text-right">Unit price</th>
                <th className="py-2 pl-2 w-32 text-right">Amount</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const amount = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
                return (
                  <tr key={idx} className="border-b border-border last:border-0">
                    <td className="py-2 pr-2">
                      <input
                        value={it.description}
                        onChange={(e) => updateItem(idx, 'description', e.target.value)}
                        placeholder="Item description"
                        className="w-full h-8 px-2 rounded-md border border-border bg-background text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={it.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                        className="w-full h-8 px-2 rounded-md border border-border bg-background text-sm text-right focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={it.unitPrice}
                        onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                        className="w-full h-8 px-2 rounded-md border border-border bg-background text-sm text-right focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </td>
                    <td className="py-2 pl-2 text-right font-medium tabular-nums">
                      {formatCurrency(amount, currency)}
                    </td>
                    <td className="py-2">
                      {items.length > 1 && (
                        <button
                          onClick={() => removeItem(idx)}
                          className="p-1 rounded hover:bg-red-100 hover:text-red-600 text-muted-foreground transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end pt-3 border-t border-border">
          <div className="space-y-1.5 w-full max-w-sm">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums text-foreground">{formatCurrency(totals.subtotal, currency)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Tax</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="w-14 h-7 px-1.5 rounded-md border border-border bg-background text-xs text-right focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <span className="tabular-nums">{formatCurrency(totals.taxAmount, currency)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold pt-2 border-t border-border">
              <span>Total</span>
              <span className="tabular-nums text-primary">{formatCurrency(totals.total, currency)}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <Textarea
          label="Customer-facing notes"
          placeholder="e.g. Payment terms, thank-you message…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
        <Textarea
          label="Internal notes (not shown on document)"
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          rows={2}
        />
      </Card>
    </div>
  );
}

// ─── VIEW MODE (sent / paid / etc.) ───────────────────────────────────────────

function ViewMode({ doc }) {
  const [showSend, setShowSend]       = useState(false);
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const { mutate: accept }            = useAcceptQuote();
  const { canWrite }                  = useRole();

  const isInvoice = doc.type === 'invoice';
  const isPaid    = doc.status === 'paid';
  const isFinal   = ['paid', 'accepted', 'declined', 'cancelled', 'expired'].includes(doc.status);

  const downloadPdf = async () => {
    try {
      await downloadFile(`/documents/${doc._id}/pdf`, { filename: `${doc.number}.pdf` });
    } catch {
      toast.error('Failed to download PDF');
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Link to="/documents" className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-lg font-semibold">{doc.number}</h1>
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', STATUS_COLORS[doc.status])}>
            {doc.status}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={downloadPdf}>
            <Download className="w-4 h-4" /> PDF
          </Button>
          {canWrite && !isFinal && (
            <Button size="sm" onClick={() => setShowSend(true)}>
              <Send className="w-4 h-4" /> Send
            </Button>
          )}
          {canWrite && isInvoice && !isPaid && (
            <Button size="sm" variant="outline" onClick={() => setShowMarkPaid(true)}>
              <CheckCircle2 className="w-4 h-4" /> Mark paid
            </Button>
          )}
          {canWrite && !isInvoice && !isFinal && (
            <>
              <Button size="sm" variant="outline" onClick={() => accept(doc._id)}>
                <CheckCircle2 className="w-4 h-4" /> Accept
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowDecline(true)}>
                <XCircle className="w-4 h-4" /> Decline
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Document preview */}
      <Card className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold">{doc.fromBusinessName}</h2>
            {doc.fromEmail && <p className="text-xs text-muted-foreground">{doc.fromEmail}</p>}
            {doc.fromPhone && <p className="text-xs text-muted-foreground">{doc.fromPhone}</p>}
          </div>
          <div className="text-right">
            <p className={cn('text-2xl font-bold uppercase', isInvoice ? 'text-primary' : 'text-cyan-600')}>
              {isInvoice ? 'Invoice' : 'Quote'}
            </p>
            <p className="text-sm font-mono">{doc.number}</p>
          </div>
        </div>

        {/* Bill to + dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Bill to</p>
            <p className="font-medium">{doc.customerName}</p>
            {doc.customerCompany && <p className="text-sm text-muted-foreground">{doc.customerCompany}</p>}
            {doc.customerEmail && <p className="text-sm text-muted-foreground">{doc.customerEmail}</p>}
            {doc.customerPhone && <p className="text-sm text-muted-foreground">{doc.customerPhone}</p>}
          </div>
          <div className="text-right space-y-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Issue date</p>
              <p>{formatDate(doc.issueDate)}</p>
            </div>
            {doc.dueDate && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {isInvoice ? 'Due date' : 'Valid until'}
                </p>
                <p>{formatDate(doc.dueDate)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="py-2">Description</th>
                <th className="py-2 text-right w-16">Qty</th>
                <th className="py-2 text-right w-32">Unit price</th>
                <th className="py-2 text-right w-32">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(doc.items || []).map((it) => (
                <tr key={it._id} className="border-b border-border">
                  <td className="py-2 pr-2">{it.description}</td>
                  <td className="py-2 text-right tabular-nums">{it.quantity}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(it.unitPrice, doc.currency)}</td>
                  <td className="py-2 text-right tabular-nums font-medium">{formatCurrency(it.amount, doc.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="space-y-1.5 w-full max-w-sm">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums text-foreground">{formatCurrency(doc.subtotal, doc.currency)}</span>
            </div>
            {doc.taxRate > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Tax ({doc.taxRate}%)</span>
                <span className="tabular-nums text-foreground">{formatCurrency(doc.taxAmount, doc.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold pt-2 border-t border-border">
              <span>Total</span>
              <span className={cn('tabular-nums', isInvoice ? 'text-primary' : 'text-cyan-600')}>
                {formatCurrency(doc.total, doc.currency)}
              </span>
            </div>
            {doc.paidAt && (
              <div className="flex justify-between text-sm text-green-600 font-medium pt-1">
                <span>Paid {formatDate(doc.paidAt)}</span>
                <span className="tabular-nums">{formatCurrency(doc.paidAmount, doc.currency)}</span>
              </div>
            )}
          </div>
        </div>

        {doc.notes && (
          <div className="pt-4 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm whitespace-pre-wrap">{doc.notes}</p>
          </div>
        )}

        {doc.internalNotes && (
          <div className="pt-4 border-t border-border bg-amber-50 -mx-6 -mb-6 px-6 py-4">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Internal note (not on PDF)</p>
            <p className="text-sm whitespace-pre-wrap">{doc.internalNotes}</p>
          </div>
        )}
      </Card>

      <SendModal open={showSend} onClose={() => setShowSend(false)} doc={doc} />
      <MarkPaidModal open={showMarkPaid} onClose={() => setShowMarkPaid(false)} doc={doc} />
      <DeclineModal open={showDecline} onClose={() => setShowDecline(false)} doc={doc} />
    </div>
  );
}

// ─── SEND MODAL ──────────────────────────────────────────────────────────────

function SendModal({ open, onClose, doc }) {
  const { mutateAsync, isPending } = useSendDocument();
  const [channel, setChannel] = useState('email');
  // Track recipients per-channel so switching doesn't drop user input
  const [emailTo, setEmailTo] = useState(doc?.customerEmail || '');
  const [phoneTo, setPhoneTo] = useState(doc?.customerPhone || '');
  const to    = channel === 'email' ? emailTo    : phoneTo;
  const setTo = channel === 'email' ? setEmailTo : setPhoneTo;
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [templateId, setTemplateId] = useState('');

  // Templates for this doc's category, plus general
  const { data: templatesData } = useEmailTemplates();
  const allTemplates = templatesData?.templates || [];
  const relevantTemplates = allTemplates.filter((t) => t.category === doc?.type || t.category === 'general');

  const submit = async (e) => {
    e.preventDefault();
    const data = await mutateAsync({
      id: doc._id,
      channel,
      to,
      subject: subject || undefined,
      message: message || undefined,
      templateId: templateId || undefined,
    });
    if (channel === 'whatsapp' && data?.whatsappUrl) {
      window.open(data.whatsappUrl, '_blank');
      toast.success('WhatsApp opened with the message ready to send');
    } else {
      toast.success('Email sent');
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Send ${doc?.type} ${doc?.number}`}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setChannel('email')}
            className={cn(
              'flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors',
              channel === 'email' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40'
            )}
          >
            <Mail className="w-5 h-5" />
            <span className="text-sm font-medium">Email</span>
          </button>
          <button
            type="button"
            onClick={() => setChannel('whatsapp')}
            className={cn(
              'flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors',
              channel === 'whatsapp' ? 'border-green-600 bg-green-50 text-green-700' : 'border-border hover:border-green-300'
            )}
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm font-medium">WhatsApp</span>
          </button>
        </div>

        <Input
          label={channel === 'email' ? 'Recipient email' : 'Recipient phone (with country code)'}
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder={channel === 'email' ? 'customer@example.com' : '+254712345678'}
          required
        />

        {relevantTemplates.length > 0 && (
          <Select
            label="Use a saved template"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            options={[
              { value: '', label: 'No template — write from scratch' },
              ...relevantTemplates.map((t) => ({ value: t._id, label: t.name })),
            ]}
          />
        )}

        {channel === 'email' && (
          <Input
            label="Subject (optional)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Leave blank to use template or default"
          />
        )}

        <Textarea
          label="Message (optional)"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={channel === 'whatsapp' ? 'Leave blank for default message' : 'Leave blank to use template body'}
        />

        {channel === 'whatsapp' && (
          <p className="text-xs text-muted-foreground">
            We'll open WhatsApp with the message ready — you confirm and send from your account.
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isPending}>
            {channel === 'email' ? 'Send email' : 'Open WhatsApp'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── MARK PAID MODAL (invoice only) ──────────────────────────────────────────

function MarkPaidModal({ open, onClose, doc }) {
  const { mutateAsync, isPending } = useMarkDocumentPaid();
  const [paymentMethod, setPaymentMethod] = useState('mpesa');
  const [paymentReference, setPaymentReference] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    await mutateAsync({ id: doc._id, paymentMethod, paymentReference });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Mark ${doc?.number} as paid`}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Total due: <strong className="text-foreground">{formatCurrency(doc?.total, doc?.currency)}</strong>
        </p>
        <Select
          label="Payment method"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          options={[
            { value: 'mpesa', label: 'M-Pesa' },
            { value: 'card', label: 'Card' },
            { value: 'bank_transfer', label: 'Bank transfer' },
            { value: 'cash', label: 'Cash' },
            { value: 'other', label: 'Other' },
          ]}
        />
        <Input
          label="Reference / receipt number (optional)"
          value={paymentReference}
          onChange={(e) => setPaymentReference(e.target.value)}
          placeholder="e.g. M-Pesa code"
        />
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isPending}>Mark paid</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── DECLINE QUOTE MODAL ─────────────────────────────────────────────────────

function DeclineModal({ open, onClose, doc }) {
  const { mutateAsync, isPending } = useDeclineQuote();
  const [reason, setReason] = useState('');
  return (
    <Modal open={open} onClose={onClose} title={`Decline quote ${doc?.number}`}>
      <form onSubmit={async (e) => { e.preventDefault(); await mutateAsync({ id: doc._id, reason }); onClose(); }} className="space-y-4">
        <Textarea label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0" loading={isPending}>Mark declined</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── ROUTE COMPONENT ─────────────────────────────────────────────────────────

export default function DocumentEditor() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isNew = !id || id === 'new';

  const { data, isLoading } = useDocument(isNew ? null : id);
  const doc = data?.document;

  if (!isNew && isLoading) {
    return <div className="flex justify-center py-20"><Spinner /></div>;
  }
  if (!isNew && !doc) {
    return (
      <div className="text-center py-20 space-y-3">
        <FileText className="w-8 h-8 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">Document not found</p>
        <Link to="/documents" className="text-sm text-primary hover:underline">Back to list</Link>
      </div>
    );
  }

  const isDraft = isNew || doc?.status === 'draft';
  const type = isNew ? (searchParams.get('type') || 'invoice') : doc?.type;
  const contactIdParam = searchParams.get('contactId');

  return isDraft
    ? <EditMode doc={doc || null} type={type} contactIdParam={contactIdParam} />
    : <ViewMode doc={doc} />;
}
