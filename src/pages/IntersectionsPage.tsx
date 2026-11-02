import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Pencil, Plus, Power, Search, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIntersections, type IntersectionWithApproaches } from '@/hooks/useIntersections';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StatePanels';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IntersectionFormModal } from '@/components/intersections/IntersectionFormModal';
import { deleteIntersection, setIntersectionStatus } from '@/lib/intersectionRepository';
import { CAN_MANAGE_INTERSECTIONS } from '@/lib/permissions';
import { formatDateTime } from '@/lib/format';
import { INPUT_CLASS } from '@/components/ui/FormField';

type StatusFilter = 'all' | 'active' | 'inactive';

function approachSummary(intersection: IntersectionWithApproaches): string {
  if (intersection.approaches.length === 0) return 'No approaches configured';
  return intersection.approaches.map((approach) => approach.road_name).join(' / ');
}

function ControlModeBadge({ mode }: { mode: IntersectionWithApproaches['control_mode'] }) {
  return <Badge tone={mode === 'adaptive' ? 'info' : 'neutral'}>{mode === 'adaptive' ? 'Adaptive' : 'Fixed-time'}</Badge>;
}

function StatusBadge({ status }: { status: IntersectionWithApproaches['status'] }) {
  return <Badge tone={status === 'active' ? 'success' : 'neutral'}>{status === 'active' ? 'Active' : 'Inactive'}</Badge>;
}

export function IntersectionsPage() {
  const { profile } = useAuth();
  const canManage = profile ? CAN_MANAGE_INTERSECTIONS.includes(profile.role) : false;
  const { intersections, loading, error, reload } = useIntersections();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [formTarget, setFormTarget] = useState<IntersectionWithApproaches | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IntersectionWithApproaches | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return intersections.filter((intersection) => {
      if (statusFilter !== 'all' && intersection.status !== statusFilter) return false;
      if (!term) return true;
      return [intersection.name, intersection.code, intersection.city, approachSummary(intersection)]
        .some((value) => value.toLowerCase().includes(term));
    });
  }, [intersections, search, statusFilter]);

  const handleToggleStatus = async (intersection: IntersectionWithApproaches) => {
    const nextStatus = intersection.status === 'active' ? 'inactive' : 'active';
    setActionError(null);
    const failure = await setIntersectionStatus(intersection.id, nextStatus);
    if (failure) {
      setActionError(failure);
      return;
    }
    setNotice(`${intersection.name} is now ${nextStatus}.`);
    await reload();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    const failure = await deleteIntersection(deleteTarget.id);
    setDeleting(false);
    if (failure) {
      setActionError(failure);
      setDeleteTarget(null);
      return;
    }
    setNotice(`${deleteTarget.name} was deleted.`);
    setDeleteTarget(null);
    await reload();
  };

  const handleSaved = async () => {
    const wasEditing = formTarget !== 'new';
    setFormTarget(null);
    setNotice(wasEditing ? 'Intersection updated.' : 'Intersection created.');
    await reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-sky-700">Network</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Intersections</h1>
          <p className="mt-1 text-sm text-slate-500">Monitored junctions, their approaches, and signal timing limits.</p>
        </div>
        {canManage && (
          <Button onClick={() => setFormTarget('new')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add intersection
          </Button>
        )}
      </div>

      {notice && (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </p>
      )}
      {actionError && (
        <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {actionError}
        </p>
      )}

      <Panel>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search intersections"
              placeholder="Search by name, code, city, or road"
              className={`${INPUT_CLASS} pl-9`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter by status"
            className={`${INPUT_CLASS} sm:w-48`}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {loading ? (
          <LoadingState label="Loading intersections" />
        ) : error ? (
          <ErrorState message={error} action={<Button variant="secondary" onClick={() => void reload()}>Try again</Button>} />
        ) : intersections.length === 0 ? (
          <EmptyState
            title="No intersections yet"
            description={canManage ? 'Add your first intersection to start monitoring its signals.' : 'An administrator has not added any intersections yet.'}
            action={canManage ? <Button onClick={() => setFormTarget('new')}>Add intersection</Button> : undefined}
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matches" description="Try a different search term or status filter." />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th scope="col" className="py-3 pr-4">Intersection</th>
                    <th scope="col" className="py-3 pr-4">City</th>
                    <th scope="col" className="py-3 pr-4">Control</th>
                    <th scope="col" className="py-3 pr-4">Green limits</th>
                    <th scope="col" className="py-3 pr-4">Status</th>
                    <th scope="col" className="py-3 pr-4">Updated</th>
                    <th scope="col" className="py-3 text-right"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((intersection) => (
                    <tr key={intersection.id} className="transition-colors hover:bg-slate-50">
                      <td className="py-3 pr-4">
                        <Link to={`/intersections/${intersection.id}`} className="font-medium text-slate-900 hover:text-sky-700">
                          {intersection.name}
                        </Link>
                        <p className="text-xs text-slate-500">{intersection.code} - {approachSummary(intersection)}</p>
                      </td>
                      <td className="py-3 pr-4 text-slate-700">{intersection.city}</td>
                      <td className="py-3 pr-4"><ControlModeBadge mode={intersection.control_mode} /></td>
                      <td className="py-3 pr-4 text-slate-700">{intersection.min_green_seconds}-{intersection.max_green_seconds}s</td>
                      <td className="py-3 pr-4"><StatusBadge status={intersection.status} /></td>
                      <td className="py-3 pr-4 text-slate-500">{formatDateTime(intersection.updated_at)}</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canManage && (
                            <>
                              <Button variant="ghost" className="px-2" onClick={() => setFormTarget(intersection)} aria-label={`Edit ${intersection.name}`}>
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button variant="ghost" className="px-2" onClick={() => void handleToggleStatus(intersection)} aria-label={intersection.status === 'active' ? `Deactivate ${intersection.name}` : `Activate ${intersection.name}`}>
                                <Power className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button variant="ghost" className="px-2 text-rose-600 hover:text-rose-700" onClick={() => setDeleteTarget(intersection)} aria-label={`Delete ${intersection.name}`}>
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </>
                          )}
                          <Link to={`/intersections/${intersection.id}`} className="ml-1 inline-flex items-center text-sm font-medium text-sky-700 hover:text-sky-800">
                            Details <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-3 md:hidden">
              {filtered.map((intersection) => (
                <li key={intersection.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link to={`/intersections/${intersection.id}`} className="font-medium text-slate-900">{intersection.name}</Link>
                      <p className="text-xs text-slate-500">{intersection.code} - {intersection.city}</p>
                    </div>
                    <StatusBadge status={intersection.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <ControlModeBadge mode={intersection.control_mode} />
                    <span>Green {intersection.min_green_seconds}-{intersection.max_green_seconds}s</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link to={`/intersections/${intersection.id}`} className="text-sm font-medium text-sky-700">View details</Link>
                    {canManage && (
                      <>
                        <button type="button" className="text-sm font-medium text-slate-700" onClick={() => setFormTarget(intersection)}>Edit</button>
                        <button type="button" className="text-sm font-medium text-slate-700" onClick={() => void handleToggleStatus(intersection)}>
                          {intersection.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button type="button" className="text-sm font-medium text-rose-600" onClick={() => setDeleteTarget(intersection)}>Delete</button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      {formTarget && (
        <IntersectionFormModal
          existing={formTarget === 'new' ? null : formTarget}
          onClose={() => setFormTarget(null)}
          onSaved={() => void handleSaved()}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete intersection?"
          message={`${deleteTarget.name} and its saved simulation runs will be permanently removed. To keep the history, deactivate it instead.`}
          confirmLabel="Delete intersection"
          destructive
          loading={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
