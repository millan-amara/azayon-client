import { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import api from '@/lib/api';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');

  const called = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token found.');
      return;
    }

    if (called.current) return;  // ← add this
    called.current = true;

    api.get(`/auth/verify-email?token=${token}`)
      .then((res) => {
        setStatus('success');
        setMessage(res.data.message);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.response?.data?.error || 'Verification failed. The link may have expired.');
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'hsl(220 20% 97%)' }}>
      <div className="w-full max-w-sm text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold">{import.meta.env.VITE_APP_NAME || 'YourCRM'}</span>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          {status === 'loading' && (
            <>
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
              <h1 className="text-lg font-semibold mb-2">Verifying your email...</h1>
              <p className="text-sm text-muted-foreground">Just a moment.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <h1 className="text-lg font-semibold mb-2">Email confirmed!</h1>
              <p className="text-sm text-muted-foreground mb-6">{message}</p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center w-full h-9 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                Sign in to your account
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-6 h-6 text-red-500" />
              </div>
              <h1 className="text-lg font-semibold mb-2">Verification failed</h1>
              <p className="text-sm text-muted-foreground mb-6">{message}</p>
              <div className="space-y-2">
                <Link
                  to="/register"
                  className="block text-sm text-primary hover:underline"
                >
                  Request a new verification email
                </Link>
                <Link
                  to="/login"
                  className="block text-sm text-muted-foreground hover:underline"
                >
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}