import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ApproachRow, IntersectionRow } from '@/types/database';

export interface IntersectionWithApproaches extends IntersectionRow {
  approaches: ApproachRow[];
}

export function useIntersections() {
  const [intersections, setIntersections] = useState<IntersectionWithApproaches[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [intersectionResult, approachResult] = await Promise.all([
      supabase.from('intersections').select('*').order('name'),
      supabase.from('intersection_approaches').select('*'),
    ]);
    if (intersectionResult.error || approachResult.error) {
      setError('Intersections could not be loaded. Check your connection and try again.');
      setLoading(false);
      return;
    }
    const approachRows = (approachResult.data ?? []) as ApproachRow[];
    const combined = ((intersectionResult.data ?? []) as IntersectionRow[]).map((intersection) => ({
      ...intersection,
      approaches: approachRows.filter((approach) => approach.intersection_id === intersection.id),
    }));
    setIntersections(combined);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { intersections, loading, error, reload: load };
}
