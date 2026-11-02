import { AlertTriangle, MapPin, Siren } from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import type { MapIntersection } from '@/components/map/TrafficMap';
import type { ActiveEmergency, ActiveIncident } from '@/hooks/useLiveMapFeeds';
import { KIND_LABELS, SEVERITY_LABELS, type IncidentSeverity } from '@/lib/incidents';
import { formatDateTime } from '@/lib/format';

const SEVERITY_TONE: Record<IncidentSeverity, BadgeTone> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'danger',
};

interface MapSidePanelProps {
  intersections: MapIntersection[];
  unlocatedCount: number;
  incidents: ActiveIncident[];
  emergencies: ActiveEmergency[];
  intersectionNames: Record<string, string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function MapSidePanel({
  intersections,
  unlocatedCount,
  incidents,
  emergencies,
  intersectionNames,
  selectedId,
  onSelect,
}: MapSidePanelProps) {
  return (
    <div className="space-y-6">
      <Panel title={`Emergency priority (${emergencies.length})`} description="Requests from the live simulation. Simulated, not connected to real vehicles.">
        {emergencies.length === 0 ? (
          <p className="text-sm text-slate-600">No emergency priority requests right now.</p>
        ) : (
          <ul className="space-y-2">
            {emergencies.map((emergency) => (
              <li key={emergency.id}>
                <button
                  type="button"
                  onClick={() => onSelect(emergency.intersection_id)}
                  className="flex w-full items-start gap-3 rounded-lg bg-rose-50 px-3 py-2.5 text-left text-sm text-rose-900 transition-colors hover:bg-rose-100"
                >
                  <Siren className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="block font-medium">{emergency.approach_name} approach</span>
                    <span className="block text-xs text-rose-800">
                      {intersectionNames[emergency.intersection_id] ?? 'Unknown intersection'} - requested {formatDateTime(emergency.requested_at)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={`Active incidents (${incidents.length})`} description="Accidents, road closures, and maintenance that are not yet resolved.">
        {incidents.length === 0 ? (
          <p className="text-sm text-slate-600">No active incidents.</p>
        ) : (
          <ul className="space-y-2">
            {incidents.map((incident) => (
              <li key={incident.id}>
                <IncidentRow
                  incident={incident}
                  locationName={incident.intersection_id ? intersectionNames[incident.intersection_id] : undefined}
                  onSelect={onSelect}
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Intersections" description={unlocatedCount > 0 ? `${unlocatedCount} without coordinates are not shown on the map.` : 'Select one to focus the map.'}>
        {intersections.length === 0 ? (
          <p className="text-sm text-slate-600">No intersections have coordinates yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {intersections.map((intersection) => (
              <li key={intersection.id}>
                <button
                  type="button"
                  onClick={() => onSelect(intersection.id)}
                  aria-pressed={intersection.id === selectedId}
                  className={`flex w-full items-center justify-between gap-3 px-2 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 ${
                    intersection.id === selectedId ? 'bg-sky-50' : ''
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" />
                    <span className="truncate font-medium text-slate-900">{intersection.name}</span>
                  </span>
                  <Badge tone={intersection.status === 'active' ? 'success' : 'neutral'}>
                    {intersection.status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function IncidentRow({
  incident,
  locationName,
  onSelect,
}: {
  incident: ActiveIncident;
  locationName: string | undefined;
  onSelect: (id: string) => void;
}) {
  const content = (
    <span className="flex items-start gap-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-900">{incident.title}</span>
          <Badge tone={SEVERITY_TONE[incident.severity]}>{SEVERITY_LABELS[incident.severity]}</Badge>
        </span>
        <span className="block text-xs text-slate-500">
          {KIND_LABELS[incident.kind]} - {locationName ?? 'Citywide or area-wide'}
        </span>
      </span>
    </span>
  );

  if (!incident.intersection_id) {
    return <div className="rounded-lg px-3 py-2.5 text-sm">{content}</div>;
  }
  return (
    <button
      type="button"
      onClick={() => onSelect(incident.intersection_id as string)}
      className="w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50"
    >
      {content}
    </button>
  );
}
