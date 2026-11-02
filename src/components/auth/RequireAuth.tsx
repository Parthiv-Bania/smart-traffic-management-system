import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingState, ErrorState } from '@/components/ui/StatePanels';
import { Button } from '@/components/ui/Button';
import type { UserRole } from '@/types/database';

interface RequireAuthProps {
  children: ReactNode;
  roles?: UserRole[];
}

export function RequireAuth({ children, roles }: RequireAuthProps) {
  const { session, profile, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingState label="Checking your session" />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!profile) {
    return (
      <div className="mx-auto mt-16 max-w-md px-4">
        <ErrorState
          message="Your account profile could not be loaded. Please try signing in again."
          action={<Button variant="secondary" onClick={() => void signOut()}>Sign out</Button>}
        />
      </div>
    );
  }
  if (!profile.is_active) {
    return (
      <div className="mx-auto mt-16 max-w-md px-4">
        <ErrorState
          message="This account has been deactivated. Contact a Super Administrator to restore access."
          action={<Button variant="secondary" onClick={() => void signOut()}>Sign out</Button>}
        />
      </div>
    );
  }
  if (roles && !roles.includes(profile.role)) {
    return (
      <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
        <ShieldAlert className="h-8 w-8 text-amber-600" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-slate-900">Access restricted</h2>
        <p className="text-sm text-slate-500">Your role does not include permission to open this page.</p>
      </div>
    );
  }
  return <>{children}</>;
}
