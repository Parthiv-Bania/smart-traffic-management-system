import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Activity, MapPin, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { FormField, INPUT_CLASS } from '@/components/ui/FormField';
import { LoadingState } from '@/components/ui/StatePanels';

export function LoginPage() {
  const { session, profile, loading, signIn, signUp, requestPasswordReset } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (loading) return <LoadingState label="Loading" />;
  if (session && profile) return <Navigate to="/" replace />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === 'forgot') {
      if (!email.trim()) {
        setError('Enter your email.');
        return;
      }
      setSubmitting(true);
      const result = await requestPasswordReset(email.trim());
      setSubmitting(false);
      if (result) {
        setError(result);
      } else {
        setNotice('If an account exists for that email, a reset link has been sent.');
      }
      return;
    }

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (mode === 'signup' && !fullName.trim()) {
      setError('Enter your full name to create an account.');
      return;
    }
    setSubmitting(true);
    const result =
      mode === 'signin'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password, fullName.trim());
    setSubmitting(false);
    if (result) {
      setError(result);
    } else if (mode === 'signup') {
      setNotice('Account created. You are now signed in.');
    }
  };

  return (
    <div className="grid min-h-screen bg-slate-950 lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 text-slate-100 lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.25),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(16,185,129,0.18),transparent_40%)]" aria-hidden="true" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/20 ring-1 ring-sky-400/40">
            <Activity className="h-5 w-5 text-sky-300" aria-hidden="true" />
          </div>
          <span className="text-sm font-semibold tracking-wide">Smart Traffic Management System</span>
        </div>
        <div className="relative space-y-6">
          <h1 className="text-4xl font-semibold leading-tight">Centralized control for urban intersections</h1>
          <ul className="space-y-4 text-sm text-slate-300">
            <li className="flex gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />Role-based access for administrators, operators, analysts, and viewers.</li>
            <li className="flex gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" aria-hidden="true" />Fixed-time and adaptive signal control compared on identical traffic.</li>
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">Academic simulation. Not connected to real traffic signals or sensors.</p>
      </div>

      <div className="flex items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <p className="text-sm font-semibold text-slate-900">Smart Traffic Management System</p>
          </div>
          <h2 className="text-2xl font-semibold text-slate-900">
            {mode === 'signin' ? 'Sign in to continue' : mode === 'signup' ? 'Create an account' : 'Reset your password'}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {mode === 'signin'
              ? 'Use the email and password for your assigned role.'
              : mode === 'signup'
                ? 'The first account created becomes the Super Administrator.'
                : 'Enter your email and we will send you a link to set a new password.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            {mode === 'signup' && (
              <FormField label="Full name" htmlFor="full-name">
                <input id="full-name" className={INPUT_CLASS} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
              </FormField>
            )}
            <FormField label="Email" htmlFor="email">
              <input id="email" type="email" className={INPUT_CLASS} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </FormField>
            {mode !== 'forgot' && (
              <FormField label="Password" htmlFor="password" hint={mode === 'signup' ? 'At least 6 characters.' : undefined}>
                <input id="password" type="password" className={INPUT_CLASS} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
              </FormField>
            )}
            {mode === 'signin' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-sm font-medium text-sky-700 hover:text-sky-800 hover:underline"
                  onClick={() => {
                    setMode('forgot');
                    setError(null);
                    setNotice(null);
                  }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
            {notice && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}

            <Button type="submit" loading={submitting} className="w-full">
              {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            {mode === 'forgot' ? (
              <button
                type="button"
                className="font-medium text-sky-700 hover:text-sky-800 hover:underline"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                  setNotice(null);
                }}
              >
                Back to sign in
              </button>
            ) : (
              <>
                {mode === 'signin' ? 'New to the system?' : 'Already have an account?'}{' '}
                <button
                  type="button"
                  className="font-medium text-sky-700 hover:text-sky-800 hover:underline"
                  onClick={() => {
                    setMode(mode === 'signin' ? 'signup' : 'signin');
                    setError(null);
                    setNotice(null);
                  }}
                >
                  {mode === 'signin' ? 'Create an account' : 'Sign in instead'}
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
