import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Building2, Download, CreditCard, CheckCircle2, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

const STATUS_COLORS = {
  sent:     'bg-blue-100 text-blue-700',
  viewed:   'bg-amber-100 text-amber-700',
  paid:     'bg-green-100 text-green-700',
  overdue:  'bg-red-100 text-red-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  expired:  'bg-gray-100 text-gray-600',
};

// Public route — no auth header attached. Use a fresh axios instance.
const publicApi = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

export default function PublicDocument() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const [doc, setDoc]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [paying, setPaying]   = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const justPaid              = searchParams.get('paid') === 'success';
  const paystackReference     = searchParams.get('reference') || searchParams.get('trxref');

  useEffect(() => {
    let alive = true;
    publicApi.get(`/public/documents/${token}`)
      .then((res) => { if (alive) setDoc(res.data.document); })
      .catch((err) => { if (alive) setError(err.response?.data?.error || 'Document not found'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token]);

  // After the user is redirected back from Paystack with ?paid=success,
  // verify the transaction directly so we don't depend on the webhook.
  useEffect(() => {
    if (!justPaid || !paystackReference || !doc) return;
    if (doc.status === 'paid') return;
    let alive = true;
    // Synchronising local UI state with the result of an external API call —
    // the canonical legit use case for setState inside an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVerifying(true);
    publicApi.post(`/public/documents/${token}/verify-payment`, { reference: paystackReference })
      .then((res) => { if (alive) setDoc(res.data.document); })
      .catch(() => { /* webhook may still come through — leave the doc as-is */ })
      .finally(() => { if (alive) setVerifying(false); });
    return () => { alive = false; };
  }, [justPaid, paystackReference, doc, token]);

  const handlePay = async () => {
    // If the invoice has no email on file, validate the user-supplied one before sending
    const needsEmail = !doc?.customerEmail;
    if (needsEmail) {
      const email = emailInput.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setEmailError('Please enter a valid email');
        return;
      }
      setEmailError('');
    }

    setPaying(true);
    try {
      const { data } = await publicApi.post(
        `/public/documents/${token}/pay`,
        needsEmail ? { email: emailInput.trim() } : {}
      );
      window.location.assign(data.authorizationUrl);
    } catch (err) {
      const msg = err.response?.data?.error || 'Could not start payment';
      if (msg.toLowerCase().includes('email')) setEmailError(msg);
      else alert(msg);
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-3">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-lg font-semibold">Document unavailable</p>
          <p className="text-sm text-muted-foreground">{error || 'This link may have expired.'}</p>
        </div>
      </div>
    );
  }

  const isInvoice = doc.type === 'invoice';
  const isPaid    = doc.status === 'paid';

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Just-paid banner — copy reflects verification state */}
        {justPaid && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
            {verifying
              ? <Loader2 className="w-5 h-5 text-green-600 animate-spin shrink-0" />
              : <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />}
            <div>
              <p className="font-medium text-green-800">
                {isPaid ? 'Payment confirmed' : verifying ? 'Confirming payment…' : 'Payment received'}
              </p>
              <p className="text-xs text-green-700">
                {isPaid
                  ? 'Thanks! A receipt has been sent to your email.'
                  : verifying
                    ? 'Checking with Paystack — this should take a few seconds.'
                    : 'Thanks! Your payment is being processed and will appear here shortly.'}
              </p>
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-border flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <span className="text-base font-semibold">{doc.fromBusinessName}</span>
              </div>
              {doc.fromEmail && <p className="text-xs text-muted-foreground">{doc.fromEmail}</p>}
              {doc.fromPhone && <p className="text-xs text-muted-foreground">{doc.fromPhone}</p>}
            </div>
            <div className="text-right">
              <p className={cn('text-xl font-bold uppercase', isInvoice ? 'text-primary' : 'text-cyan-600')}>
                {isInvoice ? 'Invoice' : 'Quote'}
              </p>
              <p className="text-sm font-mono text-muted-foreground">{doc.number}</p>
              <span className={cn('inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium capitalize', STATUS_COLORS[doc.status] || 'bg-gray-100 text-gray-700')}>
                {doc.status}
              </span>
            </div>
          </div>

          {/* Bill to + dates */}
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Bill to</p>
              <p className="font-medium">{doc.customerName}</p>
              {doc.customerCompany && <p className="text-sm text-muted-foreground">{doc.customerCompany}</p>}
              {doc.customerEmail   && <p className="text-sm text-muted-foreground">{doc.customerEmail}</p>}
            </div>
            <div className="sm:text-right space-y-2">
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

          {/* Line items */}
          <div className="px-6 pb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-border text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  <th className="py-2">Description</th>
                  <th className="py-2 text-right w-12">Qty</th>
                  <th className="py-2 text-right w-28">Unit</th>
                  <th className="py-2 text-right w-28">Amount</th>
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
          <div className="px-6 pb-6 flex justify-end">
            <div className="space-y-1.5 w-full max-w-xs">
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
            </div>
          </div>

          {doc.notes && (
            <div className="px-6 pb-6 pt-4 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm whitespace-pre-wrap">{doc.notes}</p>
            </div>
          )}
        </div>

        {/* Email input — only when the invoice has no email on file and customer wants to pay online */}
        {isInvoice && !isPaid && !justPaid && !doc.customerEmail && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
            <label htmlFor="payerEmail" className="text-sm font-medium">
              Email for receipt
            </label>
            <input
              id="payerEmail"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={emailInput}
              onChange={(e) => { setEmailInput(e.target.value); setEmailError(''); }}
              className={cn(
                'w-full h-10 px-3 rounded-lg border bg-background text-sm focus-visible:outline-none focus-visible:ring-2',
                emailError
                  ? 'border-red-300 focus-visible:ring-red-300'
                  : 'border-border focus-visible:ring-ring'
              )}
            />
            {emailError
              ? <p className="text-xs text-red-600">{emailError}</p>
              : <p className="text-xs text-muted-foreground">Paystack will send your receipt here.</p>}
          </div>
        )}

        {/* Action bar */}
        <div className="flex flex-col sm:flex-row gap-2">
          <a
            href={`${import.meta.env.VITE_API_URL || '/api'}/public/documents/${token}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-border bg-card hover:bg-muted text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" /> Download PDF
          </a>
          {isInvoice && !isPaid && !justPaid && (
            <Button onClick={handlePay} loading={paying} className="flex-1">
              <CreditCard className="w-4 h-4" /> Pay {formatCurrency(doc.total, doc.currency)}
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Powered by Azayon · M-Pesa, cards & bank transfer accepted
        </p>
      </div>
    </div>
  );
}
