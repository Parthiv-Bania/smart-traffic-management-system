import { supabase } from '@/lib/supabase';

const OPEN_ERROR = 'This request could not be recorded for the live map.';
const CLOSE_ERROR = 'A finished emergency request could not be updated on the live map.';

export async function openEmergencyRequest(
  intersectionId: string,
  approachName: string,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('emergency_requests')
    .insert({ intersection_id: intersectionId, approach_name: approachName })
    .select('id')
    .single();
  if (error || !data) return { id: null, error: OPEN_ERROR };
  return { id: data.id as string, error: null };
}

export async function closeEmergencyRequest(id: string): Promise<string | null> {
  const { error } = await supabase
    .from('emergency_requests')
    .update({ status: 'cleared', cleared_at: new Date().toISOString() })
    .eq('id', id);
  return error ? CLOSE_ERROR : null;
}

export function closeEmergencyRequestWhenRecorded(
  requestId: Promise<string | null>,
  onError: (message: string) => void,
): void {
  void requestId.then(async (id) => {
    if (!id) return;
    const failure = await closeEmergencyRequest(id);
    if (failure) onError(failure);
  });
}
