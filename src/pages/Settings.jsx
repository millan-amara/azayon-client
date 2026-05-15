import { useState, useEffect, useRef } from 'react';
import { Copy, Check, Plus, Eye, EyeOff, MoreVertical, Pencil, Trash2, Clock, X, CreditCard, CheckCircle2, Zap, ArrowRight, GripVertical, ChevronDown, ChevronUp, Smartphone, Lock, Users, ShieldCheck, Shield, ShieldAlert, Upload, ImagePlus } from 'lucide-react';
import InstallAppButton from '@/components/InstallAppButton';
import { useInstallAvailable } from '@/lib/pwa';
import { useAuth } from '@/context/AuthContext';
import { useTeam, useInviteUser, useUpdateUser, useRemoveUser, useReactivateUser, usePendingInvites, useCancelInvite, usePipelines, useCreatePipeline, useUpdatePipeline, useDeletePipeline, useUpdateOrg, useEmailTemplates, useCreateEmailTemplate, useUpdateEmailTemplate, useDeleteEmailTemplate, useCustomFields, useCreateCustomField, useUpdateCustomField, useDeleteCustomField, usePaystackBanks, usePaystackSubaccount, useConnectSubaccount, useDisconnectSubaccount } from '@/hooks/useData';
import { Button, Input, Select, Card, Modal, Avatar, Badge } from '@/components/ui';
import { usePlan } from '@/context/PlanContext';
import { useUpgrade } from '@/components/Upgrade';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { formatDate, cn } from '@/lib/utils';

const COUNTRY_CODES = [
  { code: '+254', flag: '🇰🇪', name: 'Kenya' },
  { code: '+256', flag: '🇺🇬', name: 'Uganda' },
  { code: '+255', flag: '🇹🇿', name: 'Tanzania' },
  { code: '+250', flag: '🇷🇼', name: 'Rwanda' },
  { code: '+251', flag: '🇪🇹', name: 'Ethiopia' },
  { code: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { code: '+233', flag: '🇬🇭', name: 'Ghana' },
  { code: '+27',  flag: '🇿🇦', name: 'South Africa' },
  { code: '+44',  flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+1',   flag: '🇺🇸', name: 'United States' },
];

// Parses an existing phone like +254712345678 into { code: '+254', number: '712345678' }
function parsePhone(phone) {
  if (!phone) return { code: '+254', number: '' };
  const match = COUNTRY_CODES.find((c) => phone.startsWith(c.code));
  if (match) return { code: match.code, number: phone.slice(match.code.length) };
  return { code: '+254', number: phone.replace(/^\+?\d{1,3}/, '') };
}

function ProfilePhoneInput({ value, onChange }) {
  const parsed = parsePhone(value);
  const [countryCode, setCountryCode] = useState(parsed.code);
  const [number, setNumber] = useState(parsed.number);

  const handleNumberChange = (e) => {
    const raw = e.target.value.replace(/^0+/, '').replace(/\D/g, '');
    setNumber(raw);
    onChange(`${countryCode}${raw}`);
  };

  const handleCodeChange = (e) => {
    setCountryCode(e.target.value);
    onChange(`${e.target.value}${number}`);
  };

  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">Phone number</label>
      <div className="flex gap-2">
        <select
          value={countryCode}
          onChange={handleCodeChange}
          className="h-9 pl-2 pr-1 rounded-lg border border-border bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="numeric"
          placeholder="712 345 678"
          value={number}
          onChange={handleNumberChange}
          className="flex h-9 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
    </div>
  );
}

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
        <p className="text-xs text-muted-foreground">URL: <code className="text-foreground">https://yourapp.com/api/webhooks/contacts</code></p>
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

// Single source of truth for what each role can do, surfaced in the
// RolePermissionsCard. Keep this aligned with server middleware/auth.js
// (requireRole, restrictViewer) and the canWrite logic in useRole.js.
const ROLE_PERMISSIONS = [
  {
    id: 'admin',
    label: 'Admin',
    Icon: ShieldCheck,
    color: 'text-primary bg-primary/10',
    summary: 'Full control of the workspace.',
    can: [
      'Invite, edit, deactivate and reactivate team members',
      'Create, edit and delete pipelines (including who can see them)',
      'Manage billing, subscription and the Paystack subaccount',
      'Edit organisation settings, custom fields and email templates',
      'Manage automations, API keys and webhooks',
      'See and edit every deal and contact in the org',
    ],
    cannot: [],
  },
  {
    id: 'sales_rep',
    label: 'Sales rep',
    Icon: Shield,
    color: 'text-blue-600 bg-blue-50',
    summary: 'Day-to-day selling — create and manage deals, contacts and tasks.',
    can: [
      'Create, edit and delete contacts, deals and tasks',
      'Move deals through pipelines they have access to',
      'Use email templates and automations',
      'Import and export their own data',
    ],
    cannot: [
      'Manage team members or roles',
      'Edit pipelines, custom fields or org settings',
      'Access billing or the API key',
      'See pipelines they have not been added to',
    ],
  },
  {
    id: 'viewer',
    label: 'Viewer',
    Icon: ShieldAlert,
    color: 'text-muted-foreground bg-muted',
    summary: 'Read-only access — useful for stakeholders who want visibility without risk.',
    can: [
      'Browse contacts, deals, tasks and reports they can access',
      'Use search and filters',
      'Export data they can see',
    ],
    cannot: [
      'Create or edit anything (writes are blocked at the API layer)',
      'Run automations or test runs',
      'See pipelines they have not been added to',
    ],
  },
];

function RolePermissionsCard({ defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 p-4 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3 text-left">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">What can each role do?</p>
            <p className="text-xs text-muted-foreground">Admins, sales reps and viewers — at a glance.</p>
          </div>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform shrink-0', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-border divide-y divide-border">
          {ROLE_PERMISSIONS.map((role) => {
            const RoleIcon = role.Icon;
            return (
              <div key={role.id} className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn('w-7 h-7 rounded-full flex items-center justify-center', role.color)}>
                    <RoleIcon className="w-3.5 h-3.5" />
                  </div>
                  <p className="text-sm font-semibold">{role.label}</p>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{role.summary}</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-[11px] font-semibold text-green-700 uppercase tracking-wide mb-1">Can</p>
                    <ul className="space-y-1">
                      {role.can.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {role.cannot.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-red-700 uppercase tracking-wide mb-1">Cannot</p>
                      <ul className="space-y-1">
                        {role.cannot.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs">
                            <X className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
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
        <RolePermissionsCard />
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
    <div className="space-y-4">
    <RolePermissionsCard />
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
    </div>
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

// ─── ORG SETTINGS CONSTANTS ───────────────────────────────────────────────────

const CURRENCIES = [
  { code: 'KES', label: 'KES — Kenyan Shilling' },
  { code: 'UGX', label: 'UGX — Ugandan Shilling' },
  { code: 'TZS', label: 'TZS — Tanzanian Shilling' },
  { code: 'RWF', label: 'RWF — Rwandan Franc' },
  { code: 'ETB', label: 'ETB — Ethiopian Birr' },
  { code: 'NGN', label: 'NGN — Nigerian Naira' },
  { code: 'GHS', label: 'GHS — Ghanaian Cedi' },
  { code: 'ZAR', label: 'ZAR — South African Rand' },
  { code: 'EGP', label: 'EGP — Egyptian Pound' },
  { code: 'MAD', label: 'MAD — Moroccan Dirham' },
  { code: 'XOF', label: 'XOF — West African CFA Franc' },
  { code: 'XAF', label: 'XAF — Central African CFA Franc' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
];

const TIMEZONES = [
  { code: 'Africa/Nairobi', label: 'Nairobi (EAT, UTC+3)' },
  { code: 'Africa/Kampala', label: 'Kampala (EAT, UTC+3)' },
  { code: 'Africa/Dar_es_Salaam', label: 'Dar es Salaam (EAT, UTC+3)' },
  { code: 'Africa/Kigali', label: 'Kigali (CAT, UTC+2)' },
  { code: 'Africa/Addis_Ababa', label: 'Addis Ababa (EAT, UTC+3)' },
  { code: 'Africa/Lagos', label: 'Lagos (WAT, UTC+1)' },
  { code: 'Africa/Accra', label: 'Accra (GMT, UTC+0)' },
  { code: 'Africa/Johannesburg', label: 'Johannesburg (SAST, UTC+2)' },
  { code: 'Africa/Cairo', label: 'Cairo (EET, UTC+2)' },
  { code: 'Africa/Casablanca', label: 'Casablanca (WET, UTC+1)' },
  { code: 'UTC', label: 'UTC' },
];

const DATE_FORMATS = [
  { code: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2026)' },
  { code: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2026)' },
  { code: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2026-12-31)' },
];

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

// Renders the entire "Install on your phone" card only when the browser has
// surfaced an install prompt. Once installed, the browser stops firing
// beforeinstallprompt → the card disappears completely.
function InstallAppCard() {
  const available = useInstallAvailable();
  if (!available) return null;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Smartphone className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Install on your phone</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add Azayon to your home screen for fast, app-like access. Works on Android Chrome and most mobile browsers.
            </p>
          </div>
        </div>
        <InstallAppButton />
      </div>
    </Card>
  );
}

// Branding card — controls the logo, brand color, business address, and
// document footer text shown on PDF invoices/quotes and the public document
// page. Logo upload writes to Cloudinary directly from the browser and
// persists the URL via PUT /orgs/me immediately on success (matches the
// Attachments component). The other fields are part of the parent
// GeneralTab form and save on its "Save changes" button.
function BrandingCard({
  org,
  brandColor, address, footerText, billingEmail, billingPhone,
  onBrandColorChange, onAddressChange, onFooterTextChange,
  onBillingEmailChange, onBillingPhoneChange,
}) {
  const { updateOrg } = useAuth();
  const CLOUD_NAME    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  const [logoUrl,   setLogoUrl]   = useState(org?.settings?.branding?.logoUrl || '');
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  // Persist just the logo fields without touching anything else in the org.
  // We use the same PUT /orgs/me endpoint but only send the branding subset
  // so unrelated form state in the parent doesn't get prematurely saved.
  const persistLogo = async (url, publicId) => {
    const { data } = await api.put('/orgs/me', {
      settings: { branding: { logoUrl: url || '', logoPublicId: publicId || '' } },
    });
    if (data?.org) updateOrg(data.org);
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      return toast.error('Please upload an image file (PNG or JPG)');
    }
    if (file.size > 2 * 1024 * 1024) {
      return toast.error('Logo must be under 2MB');
    }
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      return toast.error('Image uploads not configured. Add Cloudinary vars to client .env');
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', UPLOAD_PRESET);
      formData.append('folder', `crm/org-logos/${org?._id || 'misc'}`);

      const cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData },
      );
      if (!cloudRes.ok) throw new Error('Upload failed');
      const cloud = await cloudRes.json();

      await persistLogo(cloud.secure_url, cloud.public_id);
      setLogoUrl(cloud.secure_url);
      toast.success('Logo updated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    if (!confirm('Remove the logo? Future invoices and quotes will be sent without it.')) return;
    setUploading(true);
    try {
      await persistLogo('', '');
      setLogoUrl('');
      toast.success('Logo removed');
    } catch {
      toast.error('Failed to remove logo');
    } finally {
      setUploading(false);
    }
  };

  // Reset to platform default — useful escape hatch when someone has picked
  // a colour they don't like and wants the original primary back.
  const DEFAULT_COLOR = '#5046e4';

  return (
    <Card className="p-5 space-y-5">
      <div>
        <h3 className="text-sm font-semibold">Branding</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Customise how your invoices, quotes, and public payment pages look. Changes apply to new documents — already-issued ones keep their original branding.
        </p>
      </div>

      {/* Logo */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Logo</label>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-20 h-20 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
            ) : (
              <ImagePlus className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              loading={uploading}
            >
              <Upload className="w-3.5 h-3.5" />
              {logoUrl ? 'Replace logo' : 'Upload logo'}
            </Button>
            {logoUrl && !uploading && (
              <Button type="button" variant="ghost" size="sm" onClick={removeLogo}>
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </Button>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">PNG or JPG, square works best. Max 2MB.</p>
      </div>

      {/* Brand color */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Brand colour</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={brandColor}
            onChange={(e) => onBrandColorChange(e.target.value)}
            className="w-12 h-9 rounded-lg border border-border cursor-pointer bg-background"
            aria-label="Brand colour"
          />
          <input
            type="text"
            value={brandColor}
            onChange={(e) => onBrandColorChange(e.target.value)}
            placeholder="#5046e4"
            className="flex h-9 w-32 rounded-lg border border-border bg-background px-3 text-sm font-mono uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            maxLength={7}
          />
          {brandColor.toLowerCase() !== DEFAULT_COLOR && (
            <button
              type="button"
              onClick={() => onBrandColorChange(DEFAULT_COLOR)}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Reset
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">Used for accents on invoice PDFs and the public payment page.</p>
      </div>

      {/* Address */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Business address</label>
        <textarea
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Street, building, city&#10;Postal code, country"
          className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground mt-1">Shown under your business name on every PDF.</p>
      </div>

      {/* Billing contact */}
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Billing email"
            type="email"
            value={billingEmail}
            onChange={(e) => onBillingEmailChange(e.target.value)}
            placeholder="billing@yourcompany.com"
          />
          <Input
            label="Billing phone"
            type="tel"
            value={billingPhone}
            onChange={(e) => onBillingPhoneChange(e.target.value)}
            placeholder="+254 700 000 000"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Shown on invoices and quotes so customers can reach your business about payment. Leave blank to use the creator's profile.
        </p>
      </div>

      {/* Footer */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Document footer</label>
        <textarea
          value={footerText}
          onChange={(e) => onFooterTextChange(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="e.g. Thank you for your business. Bank: KCB · 12345678901"
          className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground mt-1">Appears at the bottom of every PDF. Good place for payment instructions or thank-you messages.</p>
      </div>
    </Card>
  );
}

function GeneralTab({ org, isAdmin }) {
  const { updateOrg } = useAuth();
  const { mutateAsync, isPending } = useUpdateOrg();

  const [form, setForm] = useState({
    name: org?.name || '',
    currency: org?.settings?.currency || 'KES',
    timezone: org?.settings?.timezone || 'Africa/Nairobi',
    dateFormat: org?.settings?.dateFormat || 'DD/MM/YYYY',
    bhStart: org?.settings?.businessHours?.start || '09:00',
    bhEnd: org?.settings?.businessHours?.end || '17:00',
    workDays: org?.settings?.businessHours?.workDays || [1, 2, 3, 4, 5],
    brandColor:   org?.settings?.branding?.brandColor || '#5046e4',
    address:      org?.settings?.branding?.address || '',
    footerText:   org?.settings?.branding?.footerText || '',
    billingEmail: org?.settings?.branding?.billingEmail || '',
    billingPhone: org?.settings?.branding?.billingPhone || '',
  });

  // If the org's current value isn't in the list (e.g. stored timezone we don't list), keep it as an extra option
  const currencies = CURRENCIES.some((c) => c.code === form.currency)
    ? CURRENCIES
    : [{ code: form.currency, label: form.currency }, ...CURRENCIES];
  const timezones = TIMEZONES.some((t) => t.code === form.timezone)
    ? TIMEZONES
    : [{ code: form.timezone, label: form.timezone }, ...TIMEZONES];

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const toggleDay = (day) => {
    setForm((f) => ({
      ...f,
      workDays: f.workDays.includes(day)
        ? f.workDays.filter((d) => d !== day)
        : [...f.workDays, day].sort((a, b) => a - b),
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Business name is required');

    const payload = {
      name: form.name.trim(),
      settings: {
        currency: form.currency,
        timezone: form.timezone,
        dateFormat: form.dateFormat,
        businessHours: {
          start: form.bhStart,
          end: form.bhEnd,
          workDays: form.workDays,
        },
        // Logo URL/publicId are persisted immediately on upload (see BrandingCard).
        // Here we only send the form-editable branding fields.
        branding: {
          brandColor:   form.brandColor,
          address:      form.address,
          footerText:   form.footerText,
          billingEmail: form.billingEmail.trim(),
          billingPhone: form.billingPhone.trim(),
        },
      },
    };

    const data = await mutateAsync(payload);
    if (data?.org) updateOrg(data.org);
  };

  // Read-only view for non-admins
  if (!isAdmin) {
    const logoUrl = org?.settings?.branding?.logoUrl;
    return (
      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-semibold">Organisation</h3>
        <div className="flex items-center gap-4">
          {logoUrl && (
            <img src={logoUrl} alt="Logo" className="w-14 h-14 rounded-lg border border-border object-contain bg-muted/30" />
          )}
          <div className="grid grid-cols-2 gap-4 text-sm flex-1">
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
        </div>
        <p className="text-xs text-muted-foreground pt-2 border-t border-border">
          Only admins can change organisation settings.
        </p>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <Card className="p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Organisation</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            These settings affect how dates, times and money are displayed for your team.
          </p>
        </div>

        <Input
          label="Business name"
          value={form.name}
          onChange={set('name')}
          placeholder="e.g. Acme Ltd"
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Currency"
            value={form.currency}
            onChange={set('currency')}
            options={currencies.map((c) => ({ value: c.code, label: c.label }))}
          />
          <Select
            label="Date format"
            value={form.dateFormat}
            onChange={set('dateFormat')}
            options={DATE_FORMATS.map((d) => ({ value: d.code, label: d.label }))}
          />
        </div>

        <Select
          label="Timezone"
          value={form.timezone}
          onChange={set('timezone')}
          options={timezones.map((t) => ({ value: t.code, label: t.label }))}
        />
      </Card>

      <Card className="p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Business hours</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reminders and follow-ups are sent during these hours.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Opens at</label>
            <input
              type="time"
              value={form.bhStart}
              onChange={set('bhStart')}
              className="flex h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Closes at</label>
            <input
              type="time"
              value={form.bhEnd}
              onChange={set('bhEnd')}
              className="flex h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Working days</label>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => {
              const active = form.workDays.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border text-muted-foreground hover:border-primary/40'
                  )}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <BrandingCard
        org={org}
        brandColor={form.brandColor}
        address={form.address}
        footerText={form.footerText}
        billingEmail={form.billingEmail}
        billingPhone={form.billingPhone}
        onBrandColorChange={(v) => setForm((f) => ({ ...f, brandColor: v }))}
        onAddressChange={(v) => setForm((f) => ({ ...f, address: v }))}
        onFooterTextChange={(v) => setForm((f) => ({ ...f, footerText: v }))}
        onBillingEmailChange={(v) => setForm((f) => ({ ...f, billingEmail: v }))}
        onBillingPhoneChange={(v) => setForm((f) => ({ ...f, billingPhone: v }))}
      />

      <InstallAppCard />

      <div className="flex justify-end">
        <Button type="submit" loading={isPending}>Save changes</Button>
      </div>
    </form>
  );
}

function BillingTab() {
  const { billing, refetch } = usePlan();
  const { showUpgrade } = useUpgrade();
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  if (!billing) return <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const { status, isOnTrial, trialDaysLeft, subscribedAt } = billing;
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
                    : `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} remaining — premium features unlocked, Free plan caps apply`}
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
          {isActive
            ? 'Your Growth plan includes'
            : isOnTrial
              ? 'During your trial — premium features unlocked'
              : 'Upgrade to Growth to unlock'}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            // Scale items — granted only on paid Growth. During trial these
            // stay capped at Free so the user feels the wall and converts.
            { label: '5 team members', included: isActive },
            { label: 'Unlimited contacts', included: isActive },
            { label: 'Unlimited deals', included: isActive },
            // Feature items — granted during trial AND paid Growth.
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

// ─── STAGE COLORS ─────────────────────────────────────────────────────────────

const STAGE_COLORS = [
  '#94a3b8', '#60a5fa', '#a78bfa', '#f59e0b',
  '#f97316', '#ec4899', '#14b8a6', '#22c55e', '#ef4444',
];

// ─── PIPELINES TAB ────────────────────────────────────────────────────────────

function StageRow({ stage, index, total, onChange, onRemove, onMoveUp, onMoveDown }) {
  return (
    <div className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-lg border border-border">
      <div className="flex flex-col gap-0.5 shrink-0">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          className="p-0.5 rounded hover:bg-muted disabled:opacity-20 transition-colors"
        >
          <ChevronUp className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="p-0.5 rounded hover:bg-muted disabled:opacity-20 transition-colors"
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>

      {/* Color picker */}
      <div className="relative shrink-0">
        <div
          className="w-6 h-6 rounded-full border-2 border-white shadow cursor-pointer"
          style={{ backgroundColor: stage.color }}
        />
        <input
          type="color"
          value={stage.color}
          onChange={(e) => onChange({ ...stage, color: e.target.value })}
          className="absolute inset-0 opacity-0 cursor-pointer w-6 h-6 rounded-full"
          title="Pick colour"
        />
      </div>

      <input
        type="text"
        value={stage.name}
        onChange={(e) => onChange({ ...stage, name: e.target.value })}
        placeholder="Stage name"
        className="flex-1 h-7 px-2 text-sm bg-background border border-border rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-w-0"
      />

      <input
        type="number"
        value={stage.probability}
        onChange={(e) => onChange({ ...stage, probability: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
        min="0"
        max="100"
        title="Win probability %"
        className="w-14 h-7 px-2 text-sm bg-background border border-border rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-center shrink-0"
      />
      <span className="text-xs text-muted-foreground shrink-0">%</span>

      {!stage.isWon && !stage.isLost && (
        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded hover:bg-red-100 hover:text-red-600 transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {(stage.isWon || stage.isLost) && (
        <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium shrink-0',
          stage.isWon ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
        )}>
          {stage.isWon ? 'Won' : 'Lost'}
        </span>
      )}
    </div>
  );
}

function PipelineEditor({ pipeline, onSave, onCancel, isNew }) {
  const { data: teamData } = useTeam();
  const teamMembers = (teamData?.users || []).filter((u) => u.isActive !== false);

  const [name, setName] = useState(pipeline?.name || '');
  const [visibility, setVisibility] = useState(pipeline?.visibility || 'org');
  const [allowedUsers, setAllowedUsers] = useState(
    () => (pipeline?.allowedUsers || []).map((u) => (typeof u === 'string' ? u : u._id || u))
  );
  // Lazy init — only runs on first render, so impure Math.random is acceptable here
  const [stages, setStages] = useState(() => (
    pipeline?.stages?.length
      ? pipeline.stages.map((s) => ({ ...s, _tempId: s._id || Math.random().toString(36) }))
      : [
          { _tempId: '1', name: 'New Lead', order: 0, color: '#94a3b8', probability: 10 },
          { _tempId: '2', name: 'Contacted', order: 1, color: '#60a5fa', probability: 25 },
          { _tempId: '3', name: 'Proposal Sent', order: 2, color: '#f59e0b', probability: 70 },
          { _tempId: 'won', name: 'Won', order: 3, color: '#22c55e', probability: 100, isWon: true },
          { _tempId: 'lost', name: 'Lost', order: 4, color: '#ef4444', probability: 0, isLost: true },
        ]
  ));
  const [saving, setSaving] = useState(false);

  const toggleAllowedUser = (id) => {
    setAllowedUsers((prev) => prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]);
  };

  const regularStages = stages.filter((s) => !s.isWon && !s.isLost);
  const wonStage = stages.find((s) => s.isWon);
  const lostStage = stages.find((s) => s.isLost);

  const updateStage = (tempId, updated) => {
    setStages((prev) => prev.map((s) => s._tempId === tempId ? { ...updated, _tempId: tempId } : s));
  };

  const removeStage = (tempId) => {
    if (regularStages.length <= 1) return toast.error('Pipeline needs at least one stage');
    setStages((prev) => prev.filter((s) => s._tempId !== tempId));
  };

  const addStage = () => {
    const newStage = {
      _tempId: Math.random().toString(36),
      name: '',
      color: STAGE_COLORS[regularStages.length % STAGE_COLORS.length],
      probability: 50,
    };
    // Insert before won/lost
    setStages((prev) => {
      const regular = prev.filter((s) => !s.isWon && !s.isLost);
      const special = prev.filter((s) => s.isWon || s.isLost);
      return [...regular, newStage, ...special];
    });
  };

  const moveStage = (tempId, direction) => {
    setStages((prev) => {
      const regular = prev.filter((s) => !s.isWon && !s.isLost);
      const special = prev.filter((s) => s.isWon || s.isLost);
      const idx = regular.findIndex((s) => s._tempId === tempId);
      if (idx === -1) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= regular.length) return prev;
      const reordered = [...regular];
      [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
      return [...reordered, ...special];
    });
  };

  const handleSave = async () => {
    if (!name.trim()) return toast.error('Pipeline name is required');
    if (regularStages.some((s) => !s.name.trim())) return toast.error('All stages need a name');

    const orderedStages = [
      ...regularStages.map((s, i) => ({ ...s, order: i })),
      ...(wonStage ? [{ ...wonStage, order: regularStages.length }] : []),
      ...(lostStage ? [{ ...lostStage, order: regularStages.length + 1 }] : []),
    ].map((s) => {
      // strip the client-only _tempId before sending to API
      const stage = { ...s };
      delete stage._tempId;
      return stage;
    });

    // If admin set 'restricted' but didn't pick anyone, fall back to 'org'.
    // Saving with `restricted` + empty list would lock everyone out (admins
    // bypass the filter so they'd still see it, but that's a confusing state
    // to ship a pipeline in — the toggle should reflect the working config).
    let finalVisibility = visibility;
    let finalAllowed = allowedUsers;
    if (visibility === 'restricted' && allowedUsers.length === 0) {
      finalVisibility = 'org';
      finalAllowed = [];
      toast('No users selected — visibility reset to "Everyone"', { icon: 'ℹ️' });
    }

    setSaving(true);
    await onSave({
      name: name.trim(),
      stages: orderedStages,
      visibility: finalVisibility,
      allowedUsers: finalAllowed,
    });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <Input
        label="Pipeline name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Sales Pipeline, Partnerships"
      />

      <div>
        <label className="text-sm font-medium">Who can see this pipeline?</label>
        <p className="text-xs text-muted-foreground mt-0.5 mb-2">Admins can always see and manage every pipeline regardless of this setting.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setVisibility('org')}
            className={cn(
              'p-3 rounded-lg border text-left transition-all',
              visibility === 'org' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Everyone in the org</span>
            </div>
            <p className="text-xs text-muted-foreground">All active team members can see and use this pipeline.</p>
          </button>
          <button
            type="button"
            onClick={() => setVisibility('restricted')}
            className={cn(
              'p-3 rounded-lg border text-left transition-all',
              visibility === 'restricted' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <Lock className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Restricted</span>
            </div>
            <p className="text-xs text-muted-foreground">Only the team members you select below.</p>
          </button>
        </div>

        {visibility === 'restricted' && (
          <div className="mt-3 border border-border rounded-lg p-3 bg-muted/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground">Allowed users ({allowedUsers.length})</span>
              {allowedUsers.length > 0 && (
                <button type="button" onClick={() => setAllowedUsers([])}
                  className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
              )}
            </div>
            {teamMembers.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No active team members. Invite teammates from the Team tab first.</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {teamMembers.map((member) => {
                  const checked = allowedUsers.includes(member._id);
                  return (
                    <label key={member._id}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors',
                        checked ? 'bg-primary/10' : 'hover:bg-muted'
                      )}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAllowedUser(member._id)}
                        className="rounded border-border"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{member.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{member.email} · {member.role === 'admin' ? 'Admin' : member.role === 'sales_rep' ? 'Sales rep' : 'Viewer'}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            {allowedUsers.length === 0 && teamMembers.length > 0 && (
              <p className="text-xs text-amber-700 mt-2">Pick at least one user — saving with no one selected will revert visibility to "Everyone".</p>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Stages</label>
          <span className="text-xs text-muted-foreground">Name · Colour · Win probability</span>
        </div>
        <div className="space-y-1.5">
          {regularStages.map((stage, index) => (
            <StageRow
              key={stage._tempId}
              stage={stage}
              index={index}
              total={regularStages.length}
              onChange={(updated) => updateStage(stage._tempId, updated)}
              onRemove={() => removeStage(stage._tempId)}
              onMoveUp={() => moveStage(stage._tempId, -1)}
              onMoveDown={() => moveStage(stage._tempId, 1)}
            />
          ))}
          {/* Won and Lost are always shown but not movable */}
          {wonStage && (
            <StageRow
              key={wonStage._tempId}
              stage={wonStage}
              index={0}
              total={1}
              onChange={(updated) => updateStage(wonStage._tempId, updated)}
              onRemove={() => {}}
              onMoveUp={() => {}}
              onMoveDown={() => {}}
            />
          )}
          {lostStage && (
            <StageRow
              key={lostStage._tempId}
              stage={lostStage}
              index={0}
              total={1}
              onChange={(updated) => updateStage(lostStage._tempId, updated)}
              onRemove={() => {}}
              onMoveUp={() => {}}
              onMoveDown={() => {}}
            />
          )}
        </div>
        <button
          type="button"
          onClick={addStage}
          className="mt-2 w-full flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground border border-dashed border-border rounded-lg hover:border-primary hover:text-primary transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add stage
        </button>
      </div>

      <div className="flex gap-3 pt-2 border-t border-border">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" className="flex-1" loading={saving} onClick={handleSave}>
          {isNew ? 'Create pipeline' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}

function PipelinesTab() {
  const { data: pipelinesData } = usePipelines();
  const { mutateAsync: createPipeline } = useCreatePipeline();
  const { mutateAsync: updatePipeline } = useUpdatePipeline();
  const { mutate: deletePipeline } = useDeletePipeline();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const pipelines = pipelinesData?.pipelines || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Pipelines</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Manage your sales pipelines and stages</p>
        </div>
        {!showCreate && !editingId && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> New pipeline
          </Button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="p-5">
          <h4 className="text-sm font-semibold mb-4">New pipeline</h4>
          <PipelineEditor
            isNew
            onCancel={() => setShowCreate(false)}
            onSave={async (data) => {
              await createPipeline(data);
              setShowCreate(false);
            }}
          />
        </Card>
      )}

      {/* Pipeline list */}
      {pipelines.map((pipeline) => (
        <Card key={pipeline._id} className="p-5">
          {editingId === pipeline._id ? (
            <>
              <h4 className="text-sm font-semibold mb-4">Edit: {pipeline.name}</h4>
              <PipelineEditor
                pipeline={pipeline}
                onCancel={() => setEditingId(null)}
                onSave={async (data) => {
                  await updatePipeline({ id: pipeline._id, ...data });
                  setEditingId(null);
                }}
              />
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <h4 className="text-sm font-semibold truncate">{pipeline.name}</h4>
                  {pipeline.isDefault && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium shrink-0">
                      Default
                    </span>
                  )}
                  {pipeline.visibility === 'restricted' && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium shrink-0 inline-flex items-center gap-1"
                      title={`Restricted to ${(pipeline.allowedUsers || []).length} user${(pipeline.allowedUsers || []).length === 1 ? '' : 's'}`}>
                      <Lock className="w-3 h-3" /> Restricted
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingId(pipeline._id)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                  {!pipeline.isDefault && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-500 hover:bg-red-50 hover:border-red-200"
                      onClick={() => setDeletingId(pipeline._id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Stage preview */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {pipeline.stages
                  .filter((s) => !s.isLost)
                  .sort((a, b) => a.order - b.order)
                  .map((stage, i, arr) => (
                    <div key={stage._id} className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                        <span className="text-xs text-muted-foreground">{stage.name}</span>
                      </div>
                      {i < arr.length - 1 && <span className="text-muted-foreground/40 text-xs">→</span>}
                    </div>
                  ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {pipeline.stages.filter((s) => !s.isWon && !s.isLost).length} active stages
              </p>
            </div>
          )}
        </Card>
      ))}

      {/* Delete confirmation modal */}
      <Modal
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        title="Delete pipeline"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this pipeline? Any deals in this pipeline will need to be moved manually first. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeletingId(null)}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
              onClick={() => {
                deletePipeline(deletingId);
                setDeletingId(null);
              }}
            >
              Delete pipeline
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── PAYMENTS TAB (Paystack Subaccount) ───────────────────────────────────────

function ConnectBankModal({ open, onClose, org }) {
  const { data: banksData, isLoading: banksLoading } = usePaystackBanks('kenya');
  const { mutateAsync, isPending } = useConnectSubaccount();
  const [businessName, setBusinessName] = useState(org?.name || '');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  const banks = banksData?.banks || [];
  const selectedBank = banks.find((b) => b.code === bankCode);

  const submit = async (e) => {
    e.preventDefault();
    if (!businessName.trim()) return toast.error('Business name is required');
    if (!bankCode) return toast.error('Choose your bank');
    if (!/^\d{6,20}$/.test(accountNumber.trim())) return toast.error('Account number must be digits only');

    await mutateAsync({
      businessName: businessName.trim(),
      bankCode,
      accountNumber: accountNumber.trim(),
      bankName: selectedBank?.name,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Connect bank account">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Customer payments will land in this account directly via Paystack.
          Azayon doesn't hold or touch your money.
        </p>
        <Input
          label="Business name (as it appears on your bank account)"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          required
        />
        <Select
          label="Bank"
          value={bankCode}
          onChange={(e) => setBankCode(e.target.value)}
          disabled={banksLoading}
          options={[
            { value: '', label: banksLoading ? 'Loading banks…' : 'Select your bank…' },
            ...banks.map((b) => ({ value: b.code, label: b.name })),
          ]}
        />
        <Input
          label="Account number"
          inputMode="numeric"
          placeholder="0123456789"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
          required
        />
        <p className="text-xs text-muted-foreground">
          We'll verify the account with your bank before connecting. Only the last 4 digits are stored on Azayon.
        </p>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isPending}>Verify & connect</Button>
        </div>
      </form>
    </Modal>
  );
}

function PaymentsTab({ org, isAdmin }) {
  const { data, isLoading } = usePaystackSubaccount();
  const { mutate: disconnect, isPending: disconnecting } = useDisconnectSubaccount();
  const [showConnect, setShowConnect] = useState(false);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);

  const subaccount = data?.subaccount;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Online payments</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Connect your bank account so customers can pay your invoices online.
          Funds settle directly to you — Azayon never holds them.
        </p>
      </div>

      {isLoading ? (
        <Card className="p-8 flex justify-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></Card>
      ) : subaccount?.code ? (
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">Connected</p>
                <p className="text-sm mt-0.5">
                  {subaccount.bankName || 'Bank'} ····{subaccount.accountLast4}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {subaccount.businessName} · connected {subaccount.connectedAt ? new Date(subaccount.connectedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                </p>
              </div>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowConnect(true)}>
                  Replace
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="text-red-500 hover:bg-red-50 hover:border-red-200"
                  onClick={() => setShowConfirmDisconnect(true)}
                >
                  Disconnect
                </Button>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">No bank account connected</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Customers can't pay invoices online until you connect. They can still pay you offline (M-Pesa, cash, bank transfer) and you can mark invoices as paid manually.
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowConnect(true)}>
              <CreditCard className="w-4 h-4" /> Connect bank account
            </Button>
          )}
          {!isAdmin && (
            <p className="text-xs text-muted-foreground">Only an admin can connect the bank account.</p>
          )}
        </Card>
      )}

      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border">
        <Zap className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs text-muted-foreground">
          <p><strong>How it works:</strong> Powered by Paystack Subaccounts. Each transaction settles to your bank on Paystack's standard schedule (T+1 working day in Kenya).</p>
          <p>Paystack's standard transaction fee applies (deducted on settlement). Azayon takes no cut.</p>
        </div>
      </div>

      <ConnectBankModal open={showConnect} onClose={() => setShowConnect(false)} org={org} />

      <Modal open={showConfirmDisconnect} onClose={() => setShowConfirmDisconnect(false)} title="Disconnect bank account?">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Existing invoices will lose their "Pay online" button. Customers can still see, download, and pay you offline. You can reconnect anytime.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowConfirmDisconnect(false)}>Cancel</Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
              loading={disconnecting}
              onClick={() => { disconnect(); setShowConfirmDisconnect(false); }}
            >
              Disconnect
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── EMAIL TEMPLATES TAB ──────────────────────────────────────────────────────

const TEMPLATE_CATEGORIES = [
  { value: 'invoice',    label: 'Invoice' },
  { value: 'quote',      label: 'Quote' },
  { value: 'follow_up',  label: 'Follow-up' },
  { value: 'thank_you',  label: 'Thank you' },
  { value: 'general',    label: 'General' },
];

const PLACEHOLDER_HINTS = [
  '{{customerName}}', '{{businessName}}', '{{number}}',
  '{{total}}', '{{dueDate}}', '{{publicUrl}}',
];

function TemplateEditor({ template, onCancel, onSaved }) {
  const isNew = !template?._id;
  const { mutateAsync: create } = useCreateEmailTemplate();
  const { mutateAsync: update } = useUpdateEmailTemplate();
  const [form, setForm] = useState({
    name:     template?.name     || '',
    category: template?.category || 'general',
    subject:  template?.subject  || '',
    body:     template?.body     || '',
  });
  const [saving, setSaving] = useState(false);

  const insertPlaceholder = (field, ph) => {
    setForm((f) => ({ ...f, [field]: (f[field] || '') + ph }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Template needs a name');
    if (!form.body.trim()) return toast.error('Template body is required');
    setSaving(true);
    try {
      if (isNew) await create(form);
      else await update({ id: template._id, ...form });
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5">
      <h4 className="text-sm font-semibold mb-4">{isNew ? 'New template' : `Edit: ${template.name}`}</h4>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Friendly invoice reminder"
            required
          />
          <Select
            label="Category"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            options={TEMPLATE_CATEGORIES}
          />
        </div>
        <Input
          label="Subject"
          value={form.subject}
          onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          placeholder="e.g. Reminder: Invoice {{number}} from {{businessName}}"
        />
        <div className="space-y-1.5">
          <label className="block text-sm font-medium">Body</label>
          <textarea
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            rows={6}
            placeholder="Hi {{customerName}}, …"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-muted-foreground self-center mr-1">Insert:</span>
          {PLACEHOLDER_HINTS.map((ph) => (
            <button
              key={ph}
              type="button"
              onClick={() => insertPlaceholder('body', ph)}
              className="text-[11px] font-mono px-2 py-0.5 rounded-md border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              {ph}
            </button>
          ))}
        </div>
        <div className="flex gap-3 pt-2 border-t border-border">
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={saving}>{isNew ? 'Create template' : 'Save changes'}</Button>
        </div>
      </form>
    </Card>
  );
}

function EmailTemplatesTab() {
  const { data } = useEmailTemplates();
  const { mutate: del } = useDeleteEmailTemplate();
  const [editing, setEditing] = useState(null); // null | 'new' | template
  const [deletingId, setDeletingId] = useState(null);
  const templates = data?.templates || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Email templates</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Reusable subject + body for invoices, quotes and follow-ups</p>
        </div>
        {!editing && (
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="w-4 h-4" /> New template
          </Button>
        )}
      </div>

      {editing && (
        <TemplateEditor
          template={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      )}

      {!editing && templates.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">No templates yet — create your first one to speed up sending.</p>
        </Card>
      )}

      {!editing && templates.map((t) => (
        <Card key={t._id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold">{t.name}</p>
                <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                  {t.category.replace('_', ' ')}
                </span>
              </div>
              {t.subject && <p className="text-xs text-muted-foreground mt-1 truncate">Subject: {t.subject}</p>}
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 whitespace-pre-wrap">{t.body}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setEditing(t)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="outline" className="text-red-500 hover:bg-red-50 hover:border-red-200" onClick={() => setDeletingId(t._id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      ))}

      <Modal open={!!deletingId} onClose={() => setDeletingId(null)} title="Delete template?">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">This template will be removed. Sent emails are unaffected.</p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
              onClick={() => { del(deletingId); setDeletingId(null); }}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── CUSTOM FIELDS TAB ────────────────────────────────────────────────────────

const FIELD_TYPES = [
  { value: 'text',   label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date',   label: 'Date' },
  { value: 'select', label: 'Select (dropdown)' },
];

function CustomFieldEditor({ field, onCancel, onSaved, isAdmin }) {
  const isNew = !field?._id;
  const { mutateAsync: create } = useCreateCustomField();
  const { mutateAsync: update } = useUpdateCustomField();
  const [form, setForm] = useState({
    entity:   field?.entity   || 'contact',
    label:    field?.label    || '',
    type:     field?.type     || 'text',
    options:  (field?.options || []).join(', '),
    required: field?.required || false,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return toast.error('Only admins can edit custom fields');
    if (!form.label.trim()) return toast.error('Label is required');

    const payload = {
      entity: form.entity,
      label: form.label.trim(),
      type: form.type,
      required: form.required,
      options: form.type === 'select'
        ? form.options.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    };

    if (form.type === 'select' && payload.options.length === 0) {
      return toast.error('Add at least one option for a select field');
    }

    setSaving(true);
    try {
      if (isNew) await create(payload);
      else await update({ id: field._id, label: payload.label, type: payload.type, options: payload.options, required: payload.required });
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5">
      <h4 className="text-sm font-semibold mb-4">{isNew ? 'New custom field' : `Edit: ${field.label}`}</h4>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Applies to"
            value={form.entity}
            onChange={(e) => setForm((f) => ({ ...f, entity: e.target.value }))}
            options={[
              { value: 'contact', label: 'Contact' },
              { value: 'deal', label: 'Deal' },
            ]}
            disabled={!isNew}
          />
          <Select
            label="Field type"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            options={FIELD_TYPES}
          />
        </div>
        <Input
          label="Field label"
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          placeholder="e.g. Lead source, Industry, Birthday"
          required
        />
        {form.type === 'select' && (
          <Input
            label="Options (comma-separated)"
            value={form.options}
            onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))}
            placeholder="e.g. WhatsApp, Referral, Website"
          />
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.required}
            onChange={(e) => setForm((f) => ({ ...f, required: e.target.checked }))}
            className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
          />
          <span className="text-sm">Required when creating a {form.entity}</span>
        </label>
        <div className="flex gap-3 pt-2 border-t border-border">
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={saving}>{isNew ? 'Add field' : 'Save changes'}</Button>
        </div>
      </form>
    </Card>
  );
}

function CustomFieldsTab({ isAdmin }) {
  const { data } = useCustomFields();
  const { mutate: del } = useDeleteCustomField();
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fields = data?.fields || [];
  const contactCount = fields.filter((f) => f.entity === 'contact').length;
  const dealCount    = fields.filter((f) => f.entity === 'deal').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Custom fields</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add fields specific to your business · {contactCount}/5 on contacts · {dealCount}/5 on deals
          </p>
        </div>
        {isAdmin && !editing && (
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="w-4 h-4" /> New field
          </Button>
        )}
      </div>

      {editing && (
        <CustomFieldEditor
          field={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => setEditing(null)}
          isAdmin={isAdmin}
        />
      )}

      {!editing && fields.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {isAdmin ? 'No custom fields yet — add one to capture business-specific info.' : 'No custom fields defined.'}
          </p>
        </Card>
      )}

      {!editing && ['contact', 'deal'].map((entity) => {
        const list = fields.filter((f) => f.entity === entity);
        if (list.length === 0) return null;
        return (
          <div key={entity} className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
              {entity === 'contact' ? 'Contacts' : 'Deals'} ({list.length}/5)
            </p>
            {list.map((f) => (
              <Card key={f._id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{f.label}</p>
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                        {f.type}
                      </span>
                      {f.required && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">Required</span>
                      )}
                    </div>
                    {f.type === 'select' && f.options.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">Options: {f.options.join(', ')}</p>
                    )}
                    <p className="text-[11px] font-mono text-muted-foreground mt-0.5">key: {f.key}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => setEditing(f)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-500 hover:bg-red-50 hover:border-red-200" onClick={() => setDeletingId(f._id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        );
      })}

      <Modal open={!!deletingId} onClose={() => setDeletingId(null)} title="Remove this field?">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            New {fields.find((f) => f._id === deletingId)?.entity || 'records'} won't show this field. Existing records keep the value but it won't display in the form.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
              onClick={() => { del(deletingId); setDeletingId(null); }}
            >
              Remove field
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
  const { refetch } = usePlan();
  const [showInvite, setShowInvite] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Honor any valid `?tab=` value from the URL so links can deep-link
  // (e.g. "Connect bank" banner → /settings?tab=payments)
  const VALID_TABS = ['general', 'billing', 'pipelines', 'payments', 'templates', 'fields', 'api', 'team', 'profile'];
  const tabFromUrl = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('tab')
    : null;
  const defaultTab = VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'general';
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
  }, [refetch]);

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
    ...(user?.role === 'admin' ? [{ id: 'pipelines', label: 'Pipelines' }] : []),
    { id: 'payments', label: 'Payments' },
    { id: 'templates', label: 'Email templates' },
    { id: 'fields', label: 'Custom fields' },
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

      {activeTab === 'pipelines' && <PipelinesTab />}

      {activeTab === 'payments' && org && <PaymentsTab org={org} isAdmin={user?.role === 'admin'} />}

      {activeTab === 'templates' && <EmailTemplatesTab />}

      {activeTab === 'fields' && <CustomFieldsTab isAdmin={user?.role === 'admin'} />}

      {activeTab === 'general' && org && (
        <GeneralTab org={org} isAdmin={user?.role === 'admin'} />
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
          <RolePermissionsCard />
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-4">Your profile</h3>
            <form onSubmit={saveProfile} className="space-y-4">
              <Input label="Full name" value={profileForm.name} onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))} />
              <ProfilePhoneInput
                value={profileForm.phone}
                onChange={(phone) => setProfileForm((f) => ({ ...f, phone }))}
              />
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