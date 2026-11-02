import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Incident } from '@/lib/incidents';

export type ActiveIncident = Pick<Incident, 'id' | 'intersection_id' | 'kind' | 'title' | 'severity' | 'status' | 'starts_at'>;

export interface ActiveEmergency {
  id: string;
  intersection_id: string;
  approach_name: string;
  requested_at: string;
}

const INCIDENT_LIMIT = 200;
const STALE_REFRESH_MS = 30 * 1000;
const LOAD_ERROR = 'Live incidents and emergency requests could not be refreshed. Showing the last known state.';

export function useLiveMapFeeds(onIntersectionsChanged: () => void, emergencyWindowMinutes: number) {
  const [incidents, setIncidents] = useState<ActiveIncident[]>([]);
  const [emergencies, setEmergencies] = useState<ActiveEmergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFeeds = useCallback(async () => {
    const cutoff = new Date(Date.now() - emergencyWindowMinutes * 60 * 1000).toISOString();
    const [incidentResult, emergencyResult] = await Promise.all([
      supabase
        .from('incidents')
        .select('id, intersection_id, kind, title, severity, status, starts_at')
        .neq('status', 'resolved')
        .order('starts_at', { ascending: false })
        .limit(INCIDENT_LIMIT),
      supabase
        .from('emergency_requests')
        .select('id, intersection_id, approach_name, requested_at')
        .eq('status', 'active')
        .gte('requested_at', cutoff)
        .order('requested_at', { ascending: false }),
    ]);
    if (incidentResult.error || emergencyResult.error || !Array.isArray(incidentResult.data) || !Array.isArray(emergencyResult.data)) {
      setError(LOAD_ERROR);
      setLoading(false);
      return;
    }
    setIncidents(incidentResult.data as ActiveIncident[]);
    setEmergencies(emergencyResult.data as ActiveEmergency[]);
    setError(null);
    setLoading(false);
  }, [emergencyWindowMinutes]);

  useEffect(() => {
    void loadFeeds();
    const channel = supabase
      .channel('live-traffic-map')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, () => void loadFeeds())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_requests' }, () => void loadFeeds())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'intersections' }, () => onIntersectionsChanged())
      .subscribe();
    const refreshId = window.setInterval(() => void loadFeeds(), STALE_REFRESH_MS);
    return () => {
      window.clearInterval(refreshId);
      void supabase.removeChannel(channel);
    };
  }, [loadFeeds, onIntersectionsChanged]);

  return { incidents, emergencies, loading, error };
}
