import { supabase } from '@/lib/supabase';

export const INCIDENT_KINDS = ['accident', 'road_closure', 'maintenance'] as const;
export type IncidentKind = (typeof INCIDENT_KINDS)[number];

export const INCIDENT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export const INCIDENT_STATUSES = ['open', 'in_progress', 'resolved'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const KIND_LABELS: Record<IncidentKind, string> = {
  accident: 'Accident',
  road_closure: 'Road closure',
  maintenance: 'Maintenance',
};

export const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
};

export interface Incident {
  id: string;
  intersection_id: string | null;
  kind: IncidentKind;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  starts_at: string;
  ends_at: string | null;
  reported_by: string;
  created_at: string;
  updated_at: string;
  intersections: { name: string; code: string } | null;
}

export interface IncidentDraft {
  kind: IncidentKind;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  intersection_id: string;
  starts_at: string;
  ends_at: string;
}

export type IncidentDraftErrors = Partial<Record<keyof IncidentDraft, string>>;

export interface IncidentPayload {
  kind: IncidentKind;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  intersection_id: string | null;
  starts_at: string;
  ends_at: string | null;
  updated_at: string;
}

const SAVE_ERROR = 'The incident could not be saved. Check your role permissions and try again.';
const STATUS_ERROR = 'The status could not be changed. Try again.';
const DELETE_ERROR = 'The incident could not be deleted. Try again.';

function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function createEmptyIncidentDraft(): IncidentDraft {
  return {
    kind: 'accident',
    title: '',
    description: '',
    severity: 'medium',
    status: 'open',
    intersection_id: '',
    starts_at: toLocalInputValue(new Date().toISOString()),
    ends_at: '',
  };
}

export function draftFromIncident(incident: Incident): IncidentDraft {
  return {
    kind: incident.kind,
    title: incident.title,
    description: incident.description,
    severity: incident.severity,
    status: incident.status,
    intersection_id: incident.intersection_id ?? '',
    starts_at: toLocalInputValue(incident.starts_at),
    ends_at: incident.ends_at ? toLocalInputValue(incident.ends_at) : '',
  };
}

export function validateIncidentDraft(
  draft: IncidentDraft,
): { ok: true; payload: IncidentPayload } | { ok: false; errors: IncidentDraftErrors } {
  const errors: IncidentDraftErrors = {};
  const title = draft.title.trim();
  const description = draft.description.trim();

  if (title.length < 3 || title.length > 120) errors.title = 'Use 3 to 120 characters.';
  if (description.length > 2000) errors.description = 'Keep the details under 2000 characters.';

  const startsAt = Date.parse(draft.starts_at);
  if (Number.isNaN(startsAt)) errors.starts_at = 'Enter a valid start date and time.';

  let endsAtIso: string | null = null;
  if (draft.ends_at) {
    const endsAt = Date.parse(draft.ends_at);
    if (Number.isNaN(endsAt)) errors.ends_at = 'Enter a valid end date and time.';
    else if (!Number.isNaN(startsAt) && endsAt < startsAt) errors.ends_at = 'The end must be after the start.';
    else endsAtIso = new Date(endsAt).toISOString();
  }

  if (Object.keys(errors).length > 0 || Number.isNaN(startsAt)) return { ok: false, errors };

  return {
    ok: true,
    payload: {
      kind: draft.kind,
      title,
      description,
      severity: draft.severity,
      status: draft.status,
      intersection_id: draft.intersection_id || null,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: endsAtIso,
      updated_at: new Date().toISOString(),
    },
  };
}

export async function saveIncident(payload: IncidentPayload, existingId: string | null): Promise<string | null> {
  const query = existingId
    ? supabase.from('incidents').update(payload).eq('id', existingId)
    : supabase.from('incidents').insert(payload);
  const { error } = await query;
  return error ? SAVE_ERROR : null;
}

export async function setIncidentStatus(incident: Incident, status: IncidentStatus): Promise<string | null> {
  const now = new Date().toISOString();
  const endsAt = status === 'resolved' ? (incident.ends_at ?? now) : null;
  const { error } = await supabase
    .from('incidents')
    .update({ status, ends_at: endsAt, updated_at: now })
    .eq('id', incident.id);
  return error ? STATUS_ERROR : null;
}

export async function deleteIncident(id: string): Promise<string | null> {
  const { error } = await supabase.from('incidents').delete().eq('id', id);
  return error ? DELETE_ERROR : null;
}
