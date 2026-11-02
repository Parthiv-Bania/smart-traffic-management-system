import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Incident } from '@/lib/incidents';

const INCIDENT_COLUMNS =
  'id, intersection_id, kind, title, description, severity, status, starts_at, ends_at, reported_by, created_at, updated_at, intersections(name, code)';
const INCIDENT_LIMIT = 200;
const LOAD_ERROR = 'Incidents could not be loaded. Check your connection and try again.';

export function useIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from('incidents')
      .select(INCIDENT_COLUMNS)
      .order('starts_at', { ascending: false })
      .limit(INCIDENT_LIMIT);
    if (queryError || !Array.isArray(data)) {
      setError(LOAD_ERROR);
      setLoading(false);
      return;
    }
    setIncidents(data as unknown as Incident[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { incidents, loading, error, reload: load };
}
