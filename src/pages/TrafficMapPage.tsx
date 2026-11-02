import { useCallback, useMemo, useState } from 'react';
import { Radio } from 'lucide-react';
import { TrafficMap, type MapIntersection, type MapLayers } from '@/components/map/TrafficMap';
import { MapLayerToggles } from '@/components/map/MapLayerToggles';
import { MapSidePanel } from '@/components/map/MapSidePanel';
import { Panel } from '@/components/ui/Panel';
import { ErrorState, LoadingState } from '@/components/ui/StatePanels';
import { Button } from '@/components/ui/Button';
import { useIntersections } from '@/hooks/useIntersections';
import { useLiveMapFeeds } from '@/hooks/useLiveMapFeeds';
import { DEFAULT_EMERGENCY_DISPLAY_MINUTES, useSystemSettings } from '@/hooks/useSystemSettings';

function toMapIntersection(item: {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'inactive';
  latitude: number | null;
  longitude: number | null;
}): MapIntersection | null {
  if (item.latitude === null || item.longitude === null) return null;
  const latitude = Number(item.latitude);
  const longitude = Number(item.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { id: item.id, name: item.name, code: item.code, status: item.status, latitude, longitude };
}

export function TrafficMapPage() {
  const { intersections, loading, error, reload } = useIntersections();
  const handleIntersectionsChanged = useCallback(() => void reload(), [reload]);
  const { settings } = useSystemSettings();
  const feeds = useLiveMapFeeds(
    handleIntersectionsChanged,
    settings?.emergency_display_minutes ?? DEFAULT_EMERGENCY_DISPLAY_MINUTES,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layers, setLayers] = useState<MapLayers>({ intersections: true, incidents: true, emergencies: true });

  const located = useMemo(
    () => intersections.map(toMapIntersection).filter((item): item is MapIntersection => item !== null),
    [intersections],
  );
  const intersectionNames = useMemo(
    () => Object.fromEntries(intersections.map((item) => [item.id, item.name])),
    [intersections],
  );
  const incidentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const incident of feeds.incidents) {
      if (incident.intersection_id) counts[incident.intersection_id] = (counts[incident.intersection_id] ?? 0) + 1;
    }
    return counts;
  }, [feeds.incidents]);
  const emergencyApproaches = useMemo(() => {
    const approaches: Record<string, string[]> = {};
    for (const emergency of feeds.emergencies) {
      const list = approaches[emergency.intersection_id] ?? [];
      approaches[emergency.intersection_id] = [...list, emergency.approach_name];
    }
    return approaches;
  }, [feeds.emergencies]);

  if (loading) return <LoadingState label="Loading map" />;
  if (error) {
    return <ErrorState message={error} action={<Button variant="secondary" onClick={() => void reload()}>Try again</Button>} />;
  }

  const unlocatedCount = intersections.length - located.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-sky-700">Network</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Live traffic map</h1>
          <p className="mt-1 text-sm text-slate-500">Intersections, active incidents, and emergency priority requests. Updates appear automatically.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
          <Radio className="h-3.5 w-3.5" aria-hidden="true" />
          Live
        </span>
      </div>

      {feeds.error && (
        <p role="alert" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {feeds.error}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel>
          <div className="mb-4">
            <MapLayerToggles
              layers={layers}
              counts={{
                intersections: located.length,
                incidents: feeds.incidents.length,
                emergencies: feeds.emergencies.length,
              }}
              onChange={setLayers}
            />
          </div>
          {located.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-600">
              No intersections have coordinates yet. Add latitude and longitude to an intersection to show it here.
            </p>
          ) : (
            <TrafficMap
              intersections={located}
              incidentCounts={incidentCounts}
              emergencyApproaches={emergencyApproaches}
              layers={layers}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
          <p className="mt-3 text-xs text-slate-500">
            A badge on a marker counts its active incidents. A pulsing ring means an emergency priority request is in progress.
          </p>
        </Panel>

        <MapSidePanel
          intersections={located}
          unlocatedCount={unlocatedCount}
          incidents={feeds.incidents}
          emergencies={feeds.emergencies}
          intersectionNames={intersectionNames}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>
    </div>
  );
}
