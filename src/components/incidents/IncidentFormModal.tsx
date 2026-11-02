import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, INPUT_CLASS } from '@/components/ui/FormField';
import {
  INCIDENT_KINDS,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  KIND_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  createEmptyIncidentDraft,
  draftFromIncident,
  saveIncident,
  validateIncidentDraft,
  type Incident,
  type IncidentDraft,
  type IncidentDraftErrors,
} from '@/lib/incidents';

interface IncidentFormModalProps {
  existing: Incident | null;
  intersections: { id: string; name: string; code: string }[];
  onClose: () => void;
  onSaved: () => void;
}

export function IncidentFormModal({ existing, intersections, onClose, onSaved }: IncidentFormModalProps) {
  const [draft, setDraft] = useState<IncidentDraft>(() =>
    existing ? draftFromIncident(existing) : createEmptyIncidentDraft(),
  );
  const [errors, setErrors] = useState<IncidentDraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const updateField = <K extends keyof IncidentDraft>(key: K, value: IncidentDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleSave = async () => {
    const validation = validateIncidentDraft(draft);
    if (!validation.ok) {
      setErrors(validation.errors);
      setSaveError('Fix the highlighted fields before saving.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    const failure = await saveIncident(validation.payload, existing?.id ?? null);
    setSaving(false);
    if (failure) {
      setSaveError(failure);
      return;
    }
    onSaved();
  };

  const inputClass = (key: keyof IncidentDraft) =>
    `${INPUT_CLASS} ${errors[key] ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/30' : ''}`;

  return (
    <Modal
      title={existing ? 'Edit incident' : 'Log incident'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} loading={saving}>
            {existing ? 'Save changes' : 'Log incident'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {saveError && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {saveError}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Type" htmlFor="inc-kind">
            <select id="inc-kind" className={INPUT_CLASS} value={draft.kind} onChange={(e) => updateField('kind', e.target.value as IncidentDraft['kind'])}>
              {INCIDENT_KINDS.map((kind) => (
                <option key={kind} value={kind}>{KIND_LABELS[kind]}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Severity" htmlFor="inc-severity">
            <select id="inc-severity" className={INPUT_CLASS} value={draft.severity} onChange={(e) => updateField('severity', e.target.value as IncidentDraft['severity'])}>
              {INCIDENT_SEVERITIES.map((severity) => (
                <option key={severity} value={severity}>{SEVERITY_LABELS[severity]}</option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="Title" htmlFor="inc-title" error={errors.title} hint="Example: Lane closed for drainage repair">
          <input id="inc-title" className={inputClass('title')} value={draft.title} onChange={(e) => updateField('title', e.target.value)} />
        </FormField>

        <FormField label="Location" htmlFor="inc-intersection" hint="Leave blank for a citywide or area-wide event.">
          <select id="inc-intersection" className={INPUT_CLASS} value={draft.intersection_id} onChange={(e) => updateField('intersection_id', e.target.value)}>
            <option value="">Citywide or area-wide</option>
            {intersections.map((intersection) => (
              <option key={intersection.id} value={intersection.id}>{intersection.name} ({intersection.code})</option>
            ))}
          </select>
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Starts" htmlFor="inc-starts" error={errors.starts_at}>
            <input id="inc-starts" type="datetime-local" className={inputClass('starts_at')} value={draft.starts_at} onChange={(e) => updateField('starts_at', e.target.value)} />
          </FormField>
          <FormField label="Expected or actual end" htmlFor="inc-ends" error={errors.ends_at} hint="Optional">
            <input id="inc-ends" type="datetime-local" className={inputClass('ends_at')} value={draft.ends_at} onChange={(e) => updateField('ends_at', e.target.value)} />
          </FormField>
        </div>

        <FormField label="Status" htmlFor="inc-status">
          <select id="inc-status" className={INPUT_CLASS} value={draft.status} onChange={(e) => updateField('status', e.target.value as IncidentDraft['status'])}>
            {INCIDENT_STATUSES.map((status) => (
              <option key={status} value={status}>{STATUS_LABELS[status]}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Details" htmlFor="inc-description" error={errors.description} hint="What happened, who is affected, and any diversions.">
          <textarea id="inc-description" rows={4} className={inputClass('description')} value={draft.description} onChange={(e) => updateField('description', e.target.value)} />
        </FormField>
      </div>
    </Modal>
  );
}
