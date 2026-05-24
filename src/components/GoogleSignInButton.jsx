import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

// Google Identity Services button used on both the Login and Register pages.
// The same endpoint handles both: the server creates a new org+user on first
// sign-in for an unknown email, or signs the user in if they already exist.
export default function GoogleSignInButton({ text = 'continue_with' }) {
  const { loginWithGoogle } = useAuth();

  // Hide entirely if the Client ID hasn't been configured — without it the
  // Google script would throw at startup, which is louder than just hiding.
  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) return null;

  return (
    <GoogleLogin
      onSuccess={async ({ credential }) => {
        try {
          await loginWithGoogle(credential);
        } catch (err) {
          toast.error(err.response?.data?.error || 'Google sign-in failed');
        }
      }}
      onError={() => toast.error('Google sign-in failed')}
      text={text}
      shape="rectangular"
      width="320"
      useOneTap={false}
    />
  );
}
