import { useState, useEffect } from 'react';
import { Copy, Check, Plus, Eye, EyeOff, MoreVertical, Pencil, Trash2, Clock, X, CreditCard, CheckCircle2, Zap, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTeam, useInviteUser, useUpdateUser, useRemoveUser, useReactivateUser, usePendingInvites, useCancelInvite } from '@/hooks/useData';
import { Button, Input, Select, Card, Modal, Avatar, Badge } from '@/components/ui';
import { usePlan } from '@/context/PlanContext';
import { useUpgrade } from '@/components/Upgrade';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { formatDate, cn } from '@/lib/utils';

function ApiKeySection({ org }) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(org.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('API key copied');
  };

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold mb-1">API Key (for n8n)</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Use this key in the <code className="bg-muted px-1 py-0.5 rounded">x-api-key</code> header
        when calling the CRM from n8n or any external tool.
      </p>
      <div className="flex items-center gap-2">
        <div className="flex-1 font-mono text-sm bg-muted px-3 py-2 rounded-lg border border-border truncate">
          {visible ? org.apiKey : '•'.repeat(32)}
        </div>
        <button
          onClick={() => setVisible((v) => !v)}
          className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
        <button
          onClick={copy}
          className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <div className="mt-4 bg-muted/50 rounded-lg p-3 space-y-1.5">
        <p className="text-xs font-medium">n8n HTTP Request node setup:</p>
        <p className="text-xs text-muted-foreground">URL: <code className="text-foreground">https://api.azayon.com/api/webhooks/contacts</code></p>
        <p className="text-xs text-muted-foreground">Method: <code className="text-foreground">POST</code></p>
        <p className="text-xs text-muted-foreground">Header: <code className="text-foreground">x-api-key: {visible ? org.apiKey : '(your key above)'}</code></p>
        <p className="text-xs font-medium mt-2">Available endpoints:</p>
        <p className="text-xs text-muted-foreground">POST /api/webhooks/contacts — create/upsert contact</p>
        <p className="text-xs text-muted-foreground">PUT /api/webhooks/contacts/:id — update contact</p>
        <p className="text-xs text-muted-foreground">POST /api/webhooks/deals — create deal</p>
        <p className="text-xs text-muted-foreground">GET /api/webhooks/contacts — fetch contacts</p>
        <p className="text-xs text-muted-foreground">GET /api/webhooks/deals — fetch deals</p>
        <p className="text-xs text-muted-foreground">POST /api/webhooks/events — fire automation trigger</p>
      </div>
    </Card>
  );
}

function InviteModal({ open, onClose }) {
  const { mutateAsync, isPending } = useInviteUser();
  const [form, setForm] = useState({ name: '', email: '', role: 'sales_rep' });
  const [done, setDone] = useState(false);

  const handleClose = () => {
    onClose();
    setTimeout(() => { setForm({ name: '', email: '', role: 'sales_rep' }); setDone(false); }, 300);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await mutateAsync(form);
    setDone(true);
  };

  return (
    <Modal open={open} onClose={handleClose} title="Invite team member">
      {done ? (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✉️</span>
          </div>
          <p className="font-medium mb-1">Invite sent!</p>
          <p className="text-sm text-muted-foreground mb-6">
            We emailed an invitation to <strong>{form.email}</strong>. They'll get a link to set up their account.
          </p>
          <Button className="w-full" onClick={handleClose}>Done</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
          <Select
            label="Role"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            options={[
              { value: 'sales_rep', label: 'Sales Rep' },
              { value: 'viewer', label: 'Viewer (read-only)' },
              { value: 'admin', label: 'Admin' },
            ]}
          />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>Cancel</Button>
            <Button type="submit" className="flex-1" loading={isPending}>Send invite</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function EditMemberModal({ open, onClose, member }) {
  const { mutateAsync, isPending } = useUpdateUser();
  const [form, setForm] = useState({ name: member?.name || '', role: member?.role || 'sales_rep' });

  // Sync form when member changes
  if (member && form.name !== member.name && !isPending) {
    setForm({ name: member.name, role: member.role });
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    await mutateAsync({ id: member._id, ...form });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit team member">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
        <Select
          label="Role"
          value={form.role}
          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          options={[
            { value: 'sales_rep', label: 'Sales Rep' },
            { value: 'viewer', label: 'Viewer (read-only)' },
            { value: 'admin', label: 'Admin' },
          ]}
        />
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isPending}>Save changes</Button>
        </div>
      </form>
    </Modal>
  );
}

function TeamTab({ user, teamData, onInvite }) {
  const { mutate: removeUser } = useRemoveUser();
  const { mutate: reactivateUser } = useReactivateUser();
  const { mutate: cancelInvite } = useCancelInvite();
  const { data: inviteData } = usePendingInvites(user?.role === 'admin');
  const [editingMember, setEditingMember] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
  const [deactivatingMember, setDeactivatingMember] = useState(null);

  const handleRemove = (member) => {
    setDeactivatingMember(member);
    setMenuOpen(null);
  };

  const confirmDeactivate = () => {
    if (!deactivatingMember) return;
    removeUser(deactivatingMember._id);
    setDeactivatingMember(null);
  };

  const handleReactivate = (member) => {
    reactivateUser(member._id);
    setMenuOpen(null);
  };

  const activeUsers = teamData?.users?.filter((u) => u.isActive !== false) || [];
  const inactiveUsers = teamData?.users?.filter((u) => u.isActive === false) || [];
  const pendingInvites = inviteData?.invites || [];

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">
          Team members ({activeUsers.length} active
          {inactiveUsers.length > 0 ? `, ${inactiveUsers.length} inactive` : ''}
          {pendingInvites.length > 0 ? `, ${pendingInvites.length} pending` : ''})
        </h3>
        {user?.role === 'admin' && (
          <Button size="sm" onClick={onInvite}>
            <Plus className="w-4 h-4" /> Invite
          </Button>
        )}
      </div>

      {/* Active members */}
      <div className="space-y-1">
        {activeUsers.map((member) => (
          <MemberRow
            key={member._id}
            member={member}
            currentUser={user}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            onEdit={() => { setEditingMember(member); setMenuOpen(null); }}
            onRemove={() => handleRemove(member)}
            onReactivate={() => handleReactivate(member)}
          />
        ))}
      </div>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-3 mb-1">
            Pending invites
          </p>
          <div className="space-y-1">
            {pendingInvites.map((invite) => (
              <div key={invite._id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{invite.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{invite.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    invite.isExpired
                      ? 'bg-red-100 text-red-600'
                      : 'bg-amber-100 text-amber-700'
                  )}>
                    {invite.isExpired ? 'Expired' : 'Pending'}
                  </span>
                  {user?.role === 'admin' && (
                    <button
                      onClick={() => cancelInvite(invite._id)}
                      className="p-1.5 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors text-muted-foreground opacity-0 group-hover:opacity-100"
                      title="Cancel invite"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inactive members */}
      {inactiveUsers.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-3 mb-1">
            Inactive
          </p>
          <div className="space-y-1">
            {inactiveUsers.map((member) => (
              <MemberRow
                key={member._id}
                member={member}
                currentUser={user}
                menuOpen={menuOpen}
                setMenuOpen={setMenuOpen}
                onEdit={() => { setEditingMember(member); setMenuOpen(null); }}
                onRemove={() => handleRemove(member)}
                onReactivate={() => handleReactivate(member)}
              />
            ))}
          </div>
        </div>
      )}

      <EditMemberModal
        open={!!editingMember}
        onClose={() => setEditingMember(null)}
        member={editingMember}
      />

      <Modal
        open={!!deactivatingMember}
        onClose={() => setDeactivatingMember(null)}
        title="Deactivate team member"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <span className="text-red-600 text-sm font-bold">!</span>
            </div>
            <div>
              <p className="text-sm font-medium text-red-800">
                Deactivate {deactivatingMember?.name}?
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                They will lose access immediately. All their data, contacts, and deals will be kept.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeactivatingMember(null)}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
              onClick={confirmDeactivate}
            >
              Yes, deactivate
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

function MemberRow({ member, currentUser, menuOpen, setMenuOpen, onEdit, onRemove, onReactivate }) {
  const isInactive = member.isActive === false;

  return (
    <div className={cn(
      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group',
      isInactive ? 'opacity-50' : 'hover:bg-muted/50'
    )}>
      <Avatar name={member.name} size="sm" className={isInactive ? 'grayscale' : ''} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{member.name}</p>
          {member._id === currentUser._id && (
            <span className="text-xs text-muted-foreground">(you)</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
      </div>

      {isInactive ? (
        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
          Inactive
        </span>
      ) : (
        <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
          {member.role.replace('_', ' ')}
        </Badge>
      )}

      {currentUser?.role === 'admin' && member._id !== currentUser._id && (
        <div className="relative">
          <button
            onClick={() => setMenuOpen(menuOpen === member._id ? null : member._id)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="w-4 h-4 text-muted-foreground" />
          </button>

          {menuOpen === member._id && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
              <div className="absolute right-0 top-8 w-40 bg-background border border-border rounded-lg shadow-lg z-20 py-1 overflow-hidden">
                {isInactive ? (
                  <button
                    onClick={onReactivate}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-green-50 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Reactivate
                  </button>
                ) : (
                  <>
                    <button
                      onClick={onEdit}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={onRemove}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Deactivate
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function BillingTab() {
  const { billing, refetch } = usePlan();
  const { showUpgrade } = useUpgrade();
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  if (!billing) return <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const { plan, status, isOnTrial, trialDaysLeft, subscribedAt } = billing;
  const isActive = status === 'active' || status === 'cancelling';
  const isCancelling = status === 'cancelling';
  const isPastDue = status === 'past_due';
  const isCancelled = status === 'cancelled';

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await api.post('/billing/cancel');
      toast.success('Subscription cancelled');
      refetch();
    } catch {
      toast.error('Failed to cancel — please contact support');
    } finally {
      setCancelling(false);
      setShowCancelModal(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Current plan card */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold">Current plan</h3>
            </div>

            {isOnTrial ? (
              <>
                <p className="text-2xl font-bold text-primary">Growth Trial</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {trialDaysLeft === 0
                    ? 'Trial ends today'
                    : `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} remaining — full access to all features`}
                </p>
                {/* Trial progress bar */}
                <div className="mt-3 w-48">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.max(5, ((7 - trialDaysLeft) / 7) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{7 - trialDaysLeft} of 7 days used</p>
                </div>
              </>
            ) : isActive ? (
              <>
                <p className="text-2xl font-bold text-primary">Growth — KES 3,000/mo</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {isCancelling
                    ? 'Cancels at end of billing period — features stay active until then'
                    : `Active since ${formatDate(subscribedAt)}`}
                </p>
              </>
            ) : isPastDue ? (
              <>
                <p className="text-2xl font-bold text-amber-600">Payment failed</p>
                <p className="text-sm text-muted-foreground mt-0.5">Please update your payment method to restore access</p>
              </>
            ) : isCancelled ? (
              <>
                <p className="text-2xl font-bold text-muted-foreground">Cancelled</p>
                <p className="text-sm text-muted-foreground mt-0.5">Your subscription has ended</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold">Free</p>
                <p className="text-sm text-muted-foreground mt-0.5">Limited to 200 contacts and 20 deals</p>
              </>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {(isOnTrial || !isActive || isPastDue || isCancelled) && (
              <Button onClick={() => showUpgrade('automations')}>
                <Zap className="w-4 h-4" />
                {isPastDue ? 'Update payment' : isCancelled ? 'Resubscribe' : 'Upgrade to Growth'}
              </Button>
            )}
            {isActive && !isCancelling && (
              <Button variant="outline" size="sm" onClick={() => setShowCancelModal(true)}>
                Cancel subscription
              </Button>
            )}
            {isCancelling && (
              <p className="text-xs text-muted-foreground">Cancellation scheduled</p>
            )}
          </div>
        </div>
      </Card>

      {/* What's included */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">
          {isOnTrial || isActive ? 'Growth plan includes' : 'Upgrade to Growth to unlock'}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: '5 team members', included: true },
            { label: 'Unlimited contacts', included: isOnTrial || isActive },
            { label: 'Unlimited deals', included: isOnTrial || isActive },
            { label: 'Full automations', included: isOnTrial || isActive },
            { label: 'AI summary & email drafting', included: isOnTrial || isActive },
            { label: 'File attachments', included: isOnTrial || isActive },
            { label: 'n8n / webhooks', included: isOnTrial || isActive },
            { label: 'Email support', included: isOnTrial || isActive },
          ].map(({ label, included }) => (
            <div key={label} className={cn('flex items-center gap-2 text-sm', !included && 'opacity-40')}>
              <CheckCircle2 className={cn('w-4 h-4 shrink-0', included ? 'text-green-500' : 'text-muted-foreground')} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Payment info */}
      <p className="text-xs text-muted-foreground text-center">
        Payments via Paystack · M-Pesa, cards and bank transfer accepted · Cancel anytime
      </p>

      {/* Cancel subscription modal */}
      <Modal open={showCancelModal} onClose={() => setShowCancelModal(false)} title="Cancel subscription">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to cancel? You'll keep full Growth access until the end of your current billing period. After that, your account moves to the Free plan — your data stays safe.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowCancelModal(false)}>
              Keep subscription
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
              loading={cancelling}
              onClick={handleCancel}
            >
              Yes, cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function Settings() {
  const { user, org, updateUser } = useAuth();
  const { data: teamData } = useTeam();
  const { billing, refetch } = usePlan();
  const [showInvite, setShowInvite] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Default to billing tab if coming from a payment redirect
  const defaultTab = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'billing'
    ? 'billing' : 'general';
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      toast.success('Payment successful — welcome to Growth! 🎉');
      window.history.replaceState({}, '', '/settings?tab=billing');
      // Bust the billing cache so PlanContext fetches fresh data
      sessionStorage.removeItem('billingStatus');
      sessionStorage.removeItem('billingStatusAt');
      refetch();
    }
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await api.put(`/users/${user._id}`, profileForm);
      updateUser(data.user);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword.length < 6) return toast.error('Password must be at least 6 characters');
    setSavingPassword(true);
    try {
      await api.put('/users/me/password', passwordForm);
      toast.success('Password updated');
      setPasswordForm({ currentPassword: '', newPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'General' },
    ...(user?.role === 'admin' ? [{ id: 'billing', label: 'Billing' }] : []),
    { id: 'api', label: 'API & n8n' },
    ...(user?.role === 'admin' ? [{ id: 'team', label: 'Team' }] : []),
    { id: 'profile', label: 'Profile' },
  ];

  return (
    <div className="max-w-2xl space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              activeTab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'billing' && <BillingTab />}

      {activeTab === 'general' && (
        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold">Organisation</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Business name</p>
              <p className="font-medium mt-0.5">{org?.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Currency</p>
              <p className="font-medium mt-0.5">{org?.settings?.currency}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Timezone</p>
              <p className="font-medium mt-0.5">{org?.settings?.timezone}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="font-medium mt-0.5">{formatDate(org?.createdAt)}</p>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'api' && org && <ApiKeySection org={org} />}

      {activeTab === 'team' && (
        <TeamTab
          user={user}
          teamData={teamData}
          onInvite={() => setShowInvite(true)}
        />
      )}

      {activeTab === 'profile' && (
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-4">Your profile</h3>
            <form onSubmit={saveProfile} className="space-y-4">
              <Input label="Full name" value={profileForm.name} onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))} />
              <Input label="Phone" value={profileForm.phone} onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))} />
              <Input label="Email" value={user?.email} disabled className="opacity-60" />
              <Button type="submit" loading={savingProfile}>Save changes</Button>
            </form>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-4">Change password</h3>
            <form onSubmit={savePassword} className="space-y-4">
              <Input label="Current password" type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))} required />
              <Input label="New password" type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))} required />
              <Button type="submit" loading={savingPassword}>Update password</Button>
            </form>
          </Card>
        </div>
      )}

      <InviteModal open={showInvite} onClose={() => setShowInvite(false)} />
    </div>
  );
}