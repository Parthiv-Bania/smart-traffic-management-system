import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { FormField, INPUT_CLASS } from '@/components/ui/FormField';
import { LoadingState } from '@/components/ui/StatePanels';

export function ResetPasswordPage() {
  const { session, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done) return;
    const timeoutId = window.setTimeout(() => navigate('/', { replace: true }), 1500);
    return () => window.clearTimeout(timeoutId);
  }, [done, navigate]);

  if (loading) return <LoadingState label="Checking your reset link" />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    const result = await updatePassword(password);
    setSubmitting(false);
    if (result) {
      setError(result);
    } else {
      setDone(true);
    }
  };

  // Supabase establishes a temporary session automatically when the user
  // follows the link from the reset email. No session here means the link
  // was missing, already used, or has expired.
  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">This reset link has expired</h2>
          <p className="mt-2 text-sm text-slate-500">Request a new password reset link from the sign-in page.</p>
          <Button className="mt-6 w-full" onClick={() => navigate('/login', { replace: true })}>
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/20 ring-1 ring-sky-400/40">
            <Activity className="h-5 w-5 text-sky-600" aria-hidden="true" />
          </div>
          <span className="text-sm font-semibold text-slate-900">Smart Traffic Management System</span>
        </div>
        <h2 className="text-2xl font-semibold text-slate-900">Set a new password</h2>
        <p className="mt-2 text-sm text-slate-500">Choose a new password for your account.</p>

        {done ? (
          <p role="status" className="mt-8 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Password updated. Taking you to the dashboard...
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <FormField label="New password" htmlFor="new-password" hint="At least 6 characters.">
              <input
                id="new-password"
                type="password"
                className={INPUT_CLASS}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </FormField>
            <FormField label="Confirm new password" htmlFor="confirm-password">
              <input
                id="confirm-password"
                type="password"
                className={INPUT_CLASS}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </FormField>
            {error && (
              <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            )}
            <Button type="submit" loading={submitting} className="w-full">
              Update password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
