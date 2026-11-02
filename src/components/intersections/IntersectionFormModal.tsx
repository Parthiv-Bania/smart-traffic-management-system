import { useState, type ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, INPUT_CLASS } from '@/components/ui/FormField';
import {
  createEmptyDraft,
  draftFromIntersection,
  validateDraft,
  type ApproachDraft,
  type IntersectionDraft,
} from '@/components/intersections/intersectionDraft';
import { saveIntersection } from '@/lib/intersectionRepository';
import type { IntersectionWithApproaches } from '@/hooks/useIntersections';

interface IntersectionFormModalProps {
  existing: IntersectionWithApproaches | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}

type DraftKey = Exclude<keyof IntersectionDraft, 'approaches'>;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</legend>
      {children}
    </fieldset>
  );
}

export function IntersectionFormModal({ existing, onClose, onSaved }: IntersectionFormModalProps) {
  const [draft, setDraft] = useState<IntersectionDraft>(() =>
    existing ? draftFromIntersection(existing) : createEmptyDraft(),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const updateField = (key: DraftKey, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const updateApproach = (name: ApproachDraft['name'], patch: Partial<ApproachDraft>) => {
    setDraft((current) => ({
      ...current,
      approaches: current.approaches.map((approach) =>
        approach.name === name ? { ...approach, ...patch } : approach,
      ),
    }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch) as (keyof ApproachDraft)[]) {
        delete next[`approach:${name}:${key}`];
      }
      return next;
    });
  };

  const handleSave = async () => {
    const validation = validateDraft(draft);
    if (!validation.ok) {
      setErrors(validation.errors);
      setSaveError('Fix the highlighted fields before saving.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    const result = await saveIntersection(draft, existing);
    setSaving(false);
    if (result.error) {
      setSaveError(result.error);
      return;
    }
    if (result.id) onSaved(result.id);
  };

  const errorFor = (key: string) => errors[key];
  const inputClass = (key: string) =>
    `${INPUT_CLASS} ${errors[key] ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/30' : ''}`;

  return (
    <Modal
      title={existing ? `Edit ${existing.name}` : 'Add intersection'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} loading={saving}>
            {existing ? 'Save changes' : 'Create intersection'}
          </Button>
        </>
      }
    >
      <div className="space-y-8">
        {saveError && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {saveError}
          </p>
        )}

        <Section title="Identity">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Intersection code" htmlFor="ix-code" error={errorFor('code')} hint="Example: BLR-MGR-01">
              <input id="ix-code" className={inputClass('code')} value={draft.code} onChange={(e) => updateField('code', e.target.value.toUpperCase())} />
            </FormField>
            <FormField label="Name" htmlFor="ix-name" error={errorFor('name')}>
              <input id="ix-name" className={inputClass('name')} value={draft.name} onChange={(e) => updateField('name', e.target.value)} />
            </FormField>
            <FormField label="City or area" htmlFor="ix-city" error={errorFor('city')}>
              <input id="ix-city" className={inputClass('city')} value={draft.city} onChange={(e) => updateField('city', e.target.value)} />
            </FormField>
            <FormField label="Status" htmlFor="ix-status">
              <select id="ix-status" className={INPUT_CLASS} value={draft.status} onChange={(e) => updateField('status', e.target.value as IntersectionDraft['status'])}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </FormField>
            <FormField label="Latitude (optional)" htmlFor="ix-lat" error={errorFor('latitude')}>
              <input id="ix-lat" inputMode="decimal" className={inputClass('latitude')} value={draft.latitude} onChange={(e) => updateField('latitude', e.target.value)} />
            </FormField>
            <FormField label="Longitude (optional)" htmlFor="ix-lon" error={errorFor('longitude')}>
              <input id="ix-lon" inputMode="decimal" className={inputClass('longitude')} value={draft.longitude} onChange={(e) => updateField('longitude', e.target.value)} />
            </FormField>
          </div>
        </Section>

        <Section title="Signal timing (seconds)">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Control mode" htmlFor="ix-mode" hint="Used as the default in the live simulation.">
              <select id="ix-mode" className={INPUT_CLASS} value={draft.control_mode} onChange={(e) => updateField('control_mode', e.target.value as IntersectionDraft['control_mode'])}>
                <option value="adaptive">Adaptive</option>
                <option value="fixed">Fixed-time</option>
              </select>
            </FormField>
            <FormField label="Fixed-plan green" htmlFor="ix-fixed" error={errorFor('fixed_green_seconds')}>
              <input id="ix-fixed" inputMode="numeric" className={inputClass('fixed_green_seconds')} value={draft.fixed_green_seconds} onChange={(e) => updateField('fixed_green_seconds', e.target.value)} />
            </FormField>
            <FormField label="Minimum green" htmlFor="ix-min" error={errorFor('min_green_seconds')}>
              <input id="ix-min" inputMode="numeric" className={inputClass('min_green_seconds')} value={draft.min_green_seconds} onChange={(e) => updateField('min_green_seconds', e.target.value)} />
            </FormField>
            <FormField label="Maximum green" htmlFor="ix-max" error={errorFor('max_green_seconds')}>
              <input id="ix-max" inputMode="numeric" className={inputClass('max_green_seconds')} value={draft.max_green_seconds} onChange={(e) => updateField('max_green_seconds', e.target.value)} />
            </FormField>
            <FormField label="Yellow interval" htmlFor="ix-yellow" error={errorFor('yellow_seconds')}>
              <input id="ix-yellow" inputMode="numeric" className={inputClass('yellow_seconds')} value={draft.yellow_seconds} onChange={(e) => updateField('yellow_seconds', e.target.value)} />
            </FormField>
            <FormField label="All-red clearance" htmlFor="ix-allred" error={errorFor('all_red_seconds')}>
              <input id="ix-allred" inputMode="numeric" className={inputClass('all_red_seconds')} value={draft.all_red_seconds} onChange={(e) => updateField('all_red_seconds', e.target.value)} />
            </FormField>
          </div>
        </Section>

        <Section title="Approaches">
          {errors.approaches && <p className="text-sm text-rose-700">{errors.approaches}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            {draft.approaches.map((approach) => {
              const key = (field: string) => `approach:${approach.name}:${field}`;
              return (
                <div key={approach.name} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <p className="text-sm font-semibold text-slate-800">{approach.name} approach</p>
                  <FormField label="Road name" htmlFor={`ap-${approach.name}-road`} error={errorFor(key('road_name'))}>
                    <input id={`ap-${approach.name}-road`} className={inputClass(key('road_name'))} value={approach.road_name} onChange={(e) => updateApproach(approach.name, { road_name: e.target.value })} />
                  </FormField>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Lanes" htmlFor={`ap-${approach.name}-lanes`} error={errorFor(key('lanes'))}>
                      <input id={`ap-${approach.name}-lanes`} inputMode="numeric" className={inputClass(key('lanes'))} value={approach.lanes} onChange={(e) => updateApproach(approach.name, { lanes: e.target.value })} />
                    </FormField>
                    <FormField label="Phase group" htmlFor={`ap-${approach.name}-group`}>
                      <select id={`ap-${approach.name}-group`} className={INPUT_CLASS} value={approach.phase_group} onChange={(e) => updateApproach(approach.name, { phase_group: e.target.value as ApproachDraft['phase_group'] })}>
                        <option value="A">Group A</option>
                        <option value="B">Group B</option>
                      </select>
                    </FormField>
                    <FormField label="Arrivals per min" htmlFor={`ap-${approach.name}-rate`} error={errorFor(key('base_arrival_rate'))}>
                      <input id={`ap-${approach.name}-rate`} inputMode="decimal" className={inputClass(key('base_arrival_rate'))} value={approach.base_arrival_rate} onChange={(e) => updateApproach(approach.name, { base_arrival_rate: e.target.value })} />
                    </FormField>
                    <FormField label="Saturation veh/h/lane" htmlFor={`ap-${approach.name}-sat`} error={errorFor(key('saturation_flow_vph'))}>
                      <input id={`ap-${approach.name}-sat`} inputMode="numeric" className={inputClass(key('saturation_flow_vph'))} value={approach.saturation_flow_vph} onChange={(e) => updateApproach(approach.name, { saturation_flow_vph: e.target.value })} />
                    </FormField>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      </div>
    </Modal>
  );
}
