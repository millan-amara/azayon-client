import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button, Input } from '@/components/ui';
import toast from 'react-hot-toast';
import { Building2, Mail } from 'lucide-react';
import api from '@/lib/api';

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

function PhoneInput({ value, onChange }) {
  const [countryCode, setCountryCode] = useState('+254');
  const [number, setNumber] = useState('');

  const handleNumberChange = (e) => {
    // Strip leading zero if user types it
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
            <option key={c.code} value={c.code}>
              {c.flag} {c.code}
            </option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="numeric"
          placeholder="712 345 678"
          value={number}
          onChange={handleNumberChange}
          required
          className="flex h-9 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1">Enter without leading zero — e.g. 712 345 678</p>
    </div>
  );
}

function VerifyEmailPrompt({ email }) {
  const [resending, setResending] = useState(false);
  const [sent, setSent] = useState(false);

  const resend = async () => {
    setResending(true);
    try {
      await api.post('/auth/resend-verification', { email });
      setSent(true);
      toast.success('Verification email sent');
    } catch {
      toast.error('Failed to resend');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'hsl(220 20% 97%)' }}>
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-xl font-semibold mb-2">Check your email</h1>
        <p className="text-sm text-muted-foreground mb-6">
          We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
        </p>
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <p className="text-sm text-muted-foreground">Didn't receive it? Check your spam folder or resend below.</p>
          {sent ? (
            <p className="text-sm text-green-600 font-medium">✓ Email resent successfully</p>
          ) : (
            <Button variant="outline" className="w-full" loading={resending} onClick={resend}>
              Resend verification email
            </Button>
          )}
          <Link to="/login" className="block text-sm text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', orgName: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    if (!form.phone || form.phone.length < 8) return toast.error('Please enter a valid phone number');
    setLoading(true);
    try {
      await register(form);
      setRegistered(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (registered) return <VerifyEmailPrompt email={form.email} />;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ backgroundColor: 'hsl(220 20% 97%)' }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold">{import.meta.env.VITE_APP_NAME || 'Azayon'}</span>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <h1 className="text-xl font-semibold mb-1">Create your account</h1>
          <p className="text-sm text-muted-foreground mb-6">Set up your CRM in seconds</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Business name" placeholder="Acme Ltd" value={form.orgName} onChange={set('orgName')} required />
            <Input label="Your name" placeholder="Jane Doe" value={form.name} onChange={set('name')} required />
            <Input label="Email" type="email" placeholder="you@company.com" value={form.email} onChange={set('email')} required />
            <PhoneInput
              value={form.phone}
              onChange={(phone) => setForm((f) => ({ ...f, phone }))}
            />
            <Input label="Password" type="password" placeholder="Min 6 characters" value={form.password} onChange={set('password')} required />
            <Button type="submit" className="w-full" loading={loading}>
              Create account
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}