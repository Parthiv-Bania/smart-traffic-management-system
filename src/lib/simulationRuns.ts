import { supabase } from '@/lib/supabase';
import type { SimulationMetrics, ControlMode } from '@/lib/traffic/types';
import type { SimulationRunRow } from '@/types/database';

export const SIMULATION_RUN_COLUMNS =
  'id, intersection_id, comparison_id, control_mode, duration_seconds, random_seed, traffic_intensity, metrics, created_at';

export interface NewSimulationRun {
  intersection_id: string;
  comparison_id: string | null;
  control_mode: ControlMode;
  duration_seconds: number;
  random_seed: number;
  traffic_intensity: number;
  metrics: SimulationMetrics;
}

export async function fetchSimulationRuns(
  limit: number,
  intersectionId?: string,
): Promise<{ runs: SimulationRunRow[]; error: string | null }> {
  let query = supabase
    .from('simulation_runs')
    .select(SIMULATION_RUN_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (intersectionId) query = query.eq('intersection_id', intersectionId);
  const { data, error } = await query;
  if (error) return { runs: [], error: 'Saved runs could not be loaded.' };
  return { runs: (data ?? []) as SimulationRunRow[], error: null };
}

export async function insertSimulationRuns(rows: NewSimulationRun[]): Promise<string | null> {
  const { error } = await supabase.from('simulation_runs').insert(rows);
  return error ? 'The run could not be saved. Check your role permissions and try again.' : null;
}
