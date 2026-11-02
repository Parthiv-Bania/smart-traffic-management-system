import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Panel } from '@/components/ui/Panel';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StatePanels';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTime } from '@/lib/format';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import { USER_ROLES, type ProfileRow, type UserRole } from '@/types/database';

interface PendingChange {
  profile: ProfileRow;
  newRole: UserRole;
  newIsActive: boolean;
}

export function UsersPage() {
  const { profile: currentProfile } = useAuth();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [applying, setApplying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, is_active, created_at')
      .order('created_at', { ascending: true });
    if (error) {
      setLoadError('Users could not be loaded. Check your connection and try again.');
    } else {
      setProfiles((data ?? []) as ProfileRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applyChange = async () => {
    if (!pending) return;
    setApplying(true);
    setActionError(null);
    const { error } = await supabase.rpc('admin_set_user_access', {
      target: pending.profile.id,
      new_role: pending.newRole,
      new_is_active: pending.newIsActive,
    });
    setApplying(false);
    if (error) {
      setActionError(error.message || 'The change could not be saved. Try again.');
      return;
    }
    setPending(null);
    await load();
  };

  const requestChange = (target: ProfileRow, newRole: UserRole, newIsActive: boolean) => {
    if (newRole === target.role && newIsActive === target.is_active) return;
    setActionError(null);
    setPending({ profile: target, newRole, newIsActive });
  };

  const describeChange = (change: PendingChange): string => {
    const parts: string[] = [];
    if (change.newRole !== change.profile.role) {
      parts.push(`change the role from ${ROLE_LABELS[change.profile.role]} to ${ROLE_LABELS[change.newRole]}`);
    }
    if (change.newIsActive !== change.profile.is_active) {
      parts.push(change.newIsActive ? 'restore sign-in access' : 'block sign-in access');
    }
    return `This will ${parts.join(' and ')} for ${change.profile.full_name || change.profile.email}.`;
  };

  if (loading) return <LoadingState label="Loading users" />;
  if (loadError) return <ErrorState message={loadError} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">User management</h1>
        <p className="mt-1 text-sm text-slate-600">Set what each person can do in the control centre. Every change is recorded in the audit log.</p>
      </div>

      {profiles.length === 0 ? (
        <EmptyState title="No users yet" description="Accounts appear here once people sign up." />
      ) : (
        <Panel>
          {actionError && (
            <p role="alert" className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {actionError}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-3 pr-4">Person</th>
                  <th scope="col" className="py-3 pr-4">Role</th>
                  <th scope="col" className="py-3 pr-4">Access</th>
                  <th scope="col" className="py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profiles.map((item) => {
                  const isSelf = item.id === currentProfile?.id;
                  return (
                    <tr key={item.id}>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-slate-900">{item.full_name || 'No name set'}</p>
                        <p className="text-xs text-slate-500">
                          {item.email}
                          {isSelf && ' (you)'}
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        <select
                          aria-label={`Role for ${item.email}`}
                          value={item.role}
                          disabled={isSelf}
                          onChange={(event) => requestChange(item, event.target.value as UserRole, item.is_active)}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
                        >
                          {USER_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 max-w-xs text-xs text-slate-500">{ROLE_DESCRIPTIONS[item.role]}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <Badge tone={item.is_active ? 'success' : 'danger'}>{item.is_active ? 'Active' : 'Blocked'}</Badge>
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => requestChange(item, item.role, !item.is_active)}
                            className="text-xs font-medium text-sky-700 hover:text-sky-800 disabled:cursor-not-allowed disabled:text-slate-400"
                          >
                            {item.is_active ? 'Block access' : 'Restore access'}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 text-slate-600">{formatDateTime(item.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {pending && (
        <ConfirmDialog
          title="Confirm access change"
          message={describeChange(pending)}
          confirmLabel="Apply change"
          destructive={!pending.newIsActive}
          loading={applying}
          onConfirm={() => void applyChange()}
          onCancel={() => {
            if (!applying) setPending(null);
          }}
        />
      )}
    </div>
  );
}
