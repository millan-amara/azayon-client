import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Button, Input } from '@/components/ui';
import { Building2, CheckCircle, XCircle } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [form, setForm] = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      return setError('Passwords do not match');
    }
    if (form.password.length < 6) {
      return setError('Password must be at least 6 characters');
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password: form.password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired reset link');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'hsl(220 20% 97%)' }}>
        <div className="w-full max-w-sm text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-6 h-6 text-red-500" />
          </div>
          <h1 className="text-lg font-semibold mb-2">Invalid link</h1>
          <p className="text-sm text-muted-foreground mb-4">This reset link is invalid. Please request a new one.</p>
          <Link to="/forgot-password" className="text-sm text-primary hover:underline">Request new link</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'hsl(220 20% 97%)' }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold">{import.meta.env.VITE_APP_NAME || 'Azayon'}</span>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          {success ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <h1 className="text-lg font-semibold mb-2">Password reset!</h1>
              <p className="text-sm text-muted-foreground mb-4">
                Your password has been updated. Redirecting you to sign in...
              </p>
              <Link to="/login" className="text-sm text-primary hover:underline font-medium">
                Sign in now
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold mb-1">Set new password</h1>
              <p className="text-sm text-muted-foreground mb-6">Choose a strong password for your account.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="New password"
                  type="password"
                  placeholder="Min 6 characters"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                />
                <Input
                  label="Confirm password"
                  type="password"
                  placeholder="Repeat your password"
                  value={form.confirm}
                  onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                  required
                />
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <Button type="submit" className="w-full" loading={loading}>
                  Reset password
                </Button>
              </form>

              <p className="text-sm text-center text-muted-foreground mt-4">
                <Link to="/login" className="text-primary hover:underline">Back to sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}