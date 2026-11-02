import { supabase } from '@/lib/supabase';
import type { IntersectionWithApproaches } from '@/hooks/useIntersections';
import { validateDraft, type IntersectionDraft } from '@/components/intersections/intersectionDraft';

const DUPLICATE_CODE_ERROR = 'That intersection code is already in use. Choose a different code.';
const SAVE_ERROR = 'The intersection could not be saved. Check your role permissions and try again.';

export async function saveIntersection(
  draft: IntersectionDraft,
  existing: IntersectionWithApproaches | null,
): Promise<{ error: string | null; id: string | null }> {
  const validation = validateDraft(draft);
  if (!validation.ok) return { error: 'Fix the highlighted fields before saving.', id: null };
  const { intersection, approaches } = validation.values;

  if (existing) {
    const { error } = await supabase.from('intersections').update(intersection).eq('id', existing.id);
    if (error) return { error: error.code === '23505' ? DUPLICATE_CODE_ERROR : SAVE_ERROR, id: null };

    const { error: approachError } = await supabase
      .from('intersection_approaches')
      .upsert(
        approaches.map((approach) => ({ ...approach, intersection_id: existing.id })),
        { onConflict: 'intersection_id,name' },
      );
    if (approachError) return { error: SAVE_ERROR, id: existing.id };
    return { error: null, id: existing.id };
  }

  const { data, error } = await supabase.from('intersections').insert(intersection).select('id').single();
  if (error || !data) return { error: error?.code === '23505' ? DUPLICATE_CODE_ERROR : SAVE_ERROR, id: null };

  const createdId = data.id as string;
  const { error: approachError } = await supabase
    .from('intersection_approaches')
    .insert(approaches.map((approach) => ({ ...approach, intersection_id: createdId })));
  if (approachError) {
    await supabase.from('intersections').delete().eq('id', createdId);
    return { error: SAVE_ERROR, id: null };
  }
  return { error: null, id: createdId };
}

export async function setIntersectionStatus(id: string, status: 'active' | 'inactive'): Promise<string | null> {
  const { error } = await supabase.from('intersections').update({ status }).eq('id', id);
  return error ? 'The status could not be changed. Try again.' : null;
}

export async function deleteIntersection(id: string): Promise<string | null> {
  const { error } = await supabase.from('intersections').delete().eq('id', id);
  return error ? 'The intersection could not be deleted. Try again.' : null;
}
