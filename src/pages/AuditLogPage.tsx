import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StatePanels';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';

const LOG_LIMIT = 100;

interface AuditRow {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

interface ActorRow {
  id: string;
  email: string;
  full_name: string;
}

function describeValue(value: unknown): string {
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nested]) => `${key.replace(/_/g, ' ')} ${String(nested)}`)
      .join(', ');
  }
  return String(value);
}

function summarizeDetails(details: Record<string, unknown>): string {
  const entries = Object.entries(details);
  if (entries.length === 0) return 'No details recorded';
  return entries.map(([key, value]) => `${key.replace(/_/g, ' ')}: ${describeValue(value)}`).join('; ');
}

export function AuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [actors, setActors] = useState<Record<string, ActorRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: logError } = await supabase
      .from('audit_logs')
      .select('id, actor_id, action, entity_type, entity_id, details, created_at')
      .order('created_at', { ascending: false })
      .limit(LOG_LIMIT);
    if (logError) {
      setError('The audit log could not be loaded. Check your connection and try again.');
      setLoading(false);
      return;
    }
    const logRows = (data ?? []) as AuditRow[];
    const actorIds = [...new Set(logRows.map((row) => row.actor_id).filter((id): id is string => Boolean(id)))];
    let actorMap: Record<string, ActorRow> = {};
    if (actorIds.length > 0) {
      const { data: actorData, error: actorError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', actorIds);
      if (actorError) {
        setError('Actor names could not be loaded. Try again.');
        setLoading(false);
        return;
      }
      actorMap = Object.fromEntries(((actorData ?? []) as ActorRow[]).map((actor) => [actor.id, actor]));
    }
    setRows(logRows);
    setActors(actorMap);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingState label="Loading audit log" />;
  if (error) return <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Audit log</h1>
        <p className="mt-1 text-sm text-slate-600">
          The {LOG_LIMIT} most recent recorded changes, including role and access updates. Entries cannot be edited or deleted.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No activity yet" description="Changes to users and intersections will be listed here." />
      ) : (
        <Panel>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-3 pr-4">When</th>
                  <th scope="col" className="py-3 pr-4">Who</th>
                  <th scope="col" className="py-3 pr-4">Action</th>
                  <th scope="col" className="py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const actor = row.actor_id ? actors[row.actor_id] : undefined;
                  return (
                    <tr key={row.id} className="align-top">
                      <td className="whitespace-nowrap py-3 pr-4 text-slate-600">{formatDateTime(row.created_at)}</td>
                      <td className="py-3 pr-4 text-slate-900">{actor ? actor.full_name || actor.email : 'System'}</td>
                      <td className="py-3 pr-4">
                        <Badge tone="info">{row.action.replace(/_/g, ' ')}</Badge>
                        <p className="mt-1 text-xs text-slate-500">
                          {row.entity_type} {row.entity_id}
                        </p>
                      </td>
                      <td className="py-3 text-slate-700">{summarizeDetails(row.details)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
