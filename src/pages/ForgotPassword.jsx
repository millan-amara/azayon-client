import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input } from '@/components/ui';
import { Building2, ArrowLeft, Mail } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'hsl(220 20% 97%)' }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold">{import.meta.env.VITE_APP_NAME || 'YourCRM'}</span>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          {submitted ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-lg font-semibold mb-2">Check your email</h1>
              <p className="text-sm text-muted-foreground mb-6">
                If <strong>{email}</strong> is registered, we've sent a password reset link. It expires in 1 hour.
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Don't see it? Check your spam folder.
              </p>
              <Link to="/login" className="text-sm text-primary hover:underline font-medium">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <Link to="/login" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
              </Link>
              <h1 className="text-xl font-semibold mb-1">Forgot your password?</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Enter your email and we'll send you a reset link.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Button type="submit" className="w-full" loading={loading}>
                  Send reset link
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}