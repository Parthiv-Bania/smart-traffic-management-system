import { useMemo, useState } from 'react';
import { CheckCircle2, Pencil, Plus, RotateCcw, Trash2, Play } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIntersections } from '@/hooks/useIntersections';
import { useIncidents } from '@/hooks/useIncidents';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StatePanels';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { INPUT_CLASS } from '@/components/ui/FormField';
import { IncidentFormModal } from '@/components/incidents/IncidentFormModal';
import {
  INCIDENT_KINDS,
  INCIDENT_STATUSES,
  KIND_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  deleteIncident,
  setIncidentStatus,
  type Incident,
  type IncidentKind,
  type IncidentSeverity,
  type IncidentStatus,
} from '@/lib/incidents';
import { CAN_DELETE_INCIDENTS, CAN_MANAGE_INCIDENTS } from '@/lib/permissions';
import { formatDateTime } from '@/lib/format';

type KindFilter = IncidentKind | 'all';
type StatusFilter = IncidentStatus | 'all';

const SEVERITY_TONE: Record<IncidentSeverity, BadgeTone> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'danger',
};

const STATUS_TONE: Record<IncidentStatus, BadgeTone> = {
  open: 'danger',
  in_progress: 'warning',
  resolved: 'success',
};

const NEXT_ACTION: Record<IncidentStatus, { to: IncidentStatus; label: string; icon: typeof Play }> = {
  open: { to: 'in_progress', label: 'Start work', icon: Play },
  in_progress: { to: 'resolved', label: 'Mark resolved', icon: CheckCircle2 },
  resolved: { to: 'open', label: 'Reopen', icon: RotateCcw },
};

function locationLabel(incident: Incident): string {
  return incident.intersections ? `${incident.intersections.name} (${incident.intersections.code})` : 'Citywide or area-wide';
}

function timeRangeLabel(incident: Incident): string {
  const start = `Started ${formatDateTime(incident.starts_at)}`;
  if (incident.status === 'resolved' && incident.ends_at) return `${start}, resolved ${formatDateTime(incident.ends_at)}`;
  if (incident.ends_at) return `${start}, expected to end ${formatDateTime(incident.ends_at)}`;
  return start;
}

export function IncidentsPage() {
  const { profile } = useAuth();
  const canManage = profile ? CAN_MANAGE_INCIDENTS.includes(profile.role) : false;
  const canDelete = profile ? CAN_DELETE_INCIDENTS.includes(profile.role) : false;
  const { incidents, loading, error, reload } = useIncidents();
  const { intersections } = useIntersections();

  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [formTarget, setFormTarget] = useState<Incident | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Incident | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      incidents.filter((incident) => {
        if (kindFilter !== 'all' && incident.kind !== kindFilter) return false;
        if (statusFilter !== 'all' && incident.status !== statusFilter) return false;
        return true;
      }),
    [incidents, kindFilter, statusFilter],
  );

  const activeCount = incidents.filter((incident) => incident.status !== 'resolved').length;
  const activeClosures = incidents.filter((incident) => incident.kind === 'road_closure' && incident.status !== 'resolved').length;
  const activeMaintenance = incidents.filter((incident) => incident.kind === 'maintenance' && incident.status !== 'resolved').length;

  const handleAdvance = async (incident: Incident, to: IncidentStatus) => {
    setActionError(null);
    setNotice(null);
    const failure = await setIncidentStatus(incident, to);
    if (failure) {
      setActionError(failure);
      return;
    }
    setNotice(`"${incident.title}" is now ${STATUS_LABELS[to].toLowerCase()}.`);
    await reload();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    const failure = await deleteIncident(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    if (failure) {
      setActionError(failure);
      return;
    }
    setNotice('The incident was deleted.');
    await reload();
  };

  const handleSaved = async () => {
    const wasEditing = formTarget !== 'new';
    setFormTarget(null);
    setNotice(wasEditing ? 'Incident updated.' : 'Incident logged.');
    await reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-sky-700">Operations</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Incidents</h1>
          <p className="mt-1 text-sm text-slate-500">Log accidents, road closures, and maintenance, and track them until they are resolved.</p>
        </div>
        {canManage && (
          <Button onClick={() => setFormTarget('new')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Log incident
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryTile label="Active incidents" value={activeCount} />
        <SummaryTile label="Road closures in effect" value={activeClosures} />
        <SummaryTile label="Maintenance in progress" value={activeMaintenance} />
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
          <select aria-label="Filter by type" className={`${INPUT_CLASS} sm:w-56`} value={kindFilter} onChange={(e) => setKindFilter(e.target.value as KindFilter)}>
            <option value="all">All types</option>
            {INCIDENT_KINDS.map((kind) => (
              <option key={kind} value={kind}>{KIND_LABELS[kind]}</option>
            ))}
          </select>
          <select aria-label="Filter by status" className={`${INPUT_CLASS} sm:w-56`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
            <option value="all">All statuses</option>
            {INCIDENT_STATUSES.map((status) => (
              <option key={status} value={status}>{STATUS_LABELS[status]}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <LoadingState label="Loading incidents" />
        ) : error ? (
          <ErrorState message={error} action={<Button variant="secondary" onClick={() => void reload()}>Try again</Button>} />
        ) : incidents.length === 0 ? (
          <EmptyState
            title="No incidents logged"
            description={canManage ? 'Log an accident, road closure, or maintenance job when it happens.' : 'Nothing has been logged yet.'}
            action={canManage ? <Button onClick={() => setFormTarget('new')}>Log incident</Button> : undefined}
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matches" description="Try a different type or status filter." />
        ) : (
          <ul className="space-y-4">
            {filtered.map((incident) => {
              const action = NEXT_ACTION[incident.status];
              const ActionIcon = action.icon;
              return (
                <li key={incident.id} className="rounded-xl border border-slate-200 p-5 transition-colors hover:border-slate-300">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{KIND_LABELS[incident.kind]}</Badge>
                    <Badge tone={SEVERITY_TONE[incident.severity]}>{SEVERITY_LABELS[incident.severity]} severity</Badge>
                    <Badge tone={STATUS_TONE[incident.status]}>{STATUS_LABELS[incident.status]}</Badge>
                  </div>
                  <h2 className="mt-3 text-base font-semibold text-slate-900">{incident.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">{locationLabel(incident)}</p>
                  <p className="mt-1 text-xs text-slate-500">{timeRangeLabel(incident)}</p>
                  {incident.description && <p className="mt-3 text-sm text-slate-700">{incident.description}</p>}

                  {canManage && (
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                      <Button variant="secondary" onClick={() => void handleAdvance(incident, action.to)}>
                        <ActionIcon className="h-4 w-4" aria-hidden="true" />
                        {action.label}
                      </Button>
                      <Button variant="ghost" onClick={() => setFormTarget(incident)} aria-label={`Edit ${incident.title}`}>
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Edit
                      </Button>
                      {canDelete && (
                        <Button variant="ghost" className="text-rose-600 hover:text-rose-700" onClick={() => setDeleteTarget(incident)} aria-label={`Delete ${incident.title}`}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Delete
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {formTarget && (
        <IncidentFormModal
          existing={formTarget === 'new' ? null : formTarget}
          intersections={intersections}
          onClose={() => setFormTarget(null)}
          onSaved={() => void handleSaved()}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete incident?"
          message={`"${deleteTarget.title}" will be permanently removed from the log. To keep a record, resolve it instead.`}
          confirmLabel="Delete incident"
          destructive
          loading={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
