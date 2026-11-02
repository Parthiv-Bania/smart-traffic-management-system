import { useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField, INPUT_CLASS } from '@/components/ui/FormField';
import { Panel } from '@/components/ui/Panel';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StatePanels';
import { useAuth } from '@/contexts/AuthContext';
import { useSystemSettings, type SystemSettings } from '@/hooks/useSystemSettings';
import { supabase } from '@/lib/supabase';

const NAME_MIN = 2;
const NAME_MAX = 80;
const WINDOW_MIN = 5;
const WINDOW_MAX = 60;

interface FormValues {
  organizationName: string;
  emergencyDisplayMinutes: string;
}

interface FormErrors {
  organizationName?: string;
  emergencyDisplayMinutes?: string;
}

function validate(values: FormValues): { errors: FormErrors; payload: { organization_name: string; emergency_display_minutes: number } | null } {
  const errors: FormErrors = {};
  const name = values.organizationName.trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    errors.organizationName = `Use between ${NAME_MIN} and ${NAME_MAX} characters.`;
  }
  const minutes = Number(values.emergencyDisplayMinutes);
  if (!Number.isInteger(minutes) || minutes < WINDOW_MIN || minutes > WINDOW_MAX) {
    errors.emergencyDisplayMinutes = `Enter a whole number of minutes from ${WINDOW_MIN} to ${WINDOW_MAX}.`;
  }
  if (errors.organizationName || errors.emergencyDisplayMinutes) return { errors, payload: null };
  return { errors, payload: { organization_name: name, emergency_display_minutes: minutes } };
}

function SettingsForm({ settings, onSaved }: { settings: SystemSettings; onSaved: (next: SystemSettings) => void }) {
  const { profile } = useAuth();
  const [values, setValues] = useState<FormValues>({
    organizationName: settings.organization_name,
    emergencyDisplayMinutes: String(settings.emergency_display_minutes),
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    const { errors: nextErrors, payload } = validate(values);
    setErrors(nextErrors);
    setMessage(null);
    if (!payload) return;

    setSaving(true);
    const { data, error } = await supabase
      .from('system_settings')
      .update({ ...payload, updated_at: new Date().toISOString(), updated_by: profile.id })
      .eq('id', 1)
      .select('organization_name, emergency_display_minutes, updated_at')
      .maybeSingle();
    setSaving(false);

    if (error || !data) {
      setMessage({ tone: 'error', text: 'The settings could not be saved. Check your access and try again.' });
      return;
    }
    onSaved(data as SystemSettings);
    setMessage({ tone: 'success', text: 'Settings saved. The navigation and live map use them now.' });
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} noValidate className="space-y-6">
      <FormField
        label="Organization name"
        htmlFor="organization-name"
        hint="Shown under the STMS name in the navigation."
        error={errors.organizationName}
      >
        <input
          id="organization-name"
          className={INPUT_CLASS}
          value={values.organizationName}
          maxLength={NAME_MAX}
          onChange={(event) => setValues((prev) => ({ ...prev, organizationName: event.target.value }))}
          aria-invalid={errors.organizationName ? true : undefined}
        />
      </FormField>

      <FormField
        label="Emergency display window (minutes)"
        htmlFor="emergency-window"
        hint={`An emergency request stays on the live traffic map for this long unless it is cleared first (${WINDOW_MIN} to ${WINDOW_MAX}).`}
        error={errors.emergencyDisplayMinutes}
      >
        <input
          id="emergency-window"
          type="number"
          inputMode="numeric"
          min={WINDOW_MIN}
          max={WINDOW_MAX}
          step={1}
          className={INPUT_CLASS}
          value={values.emergencyDisplayMinutes}
          onChange={(event) => setValues((prev) => ({ ...prev, emergencyDisplayMinutes: event.target.value }))}
          aria-invalid={errors.emergencyDisplayMinutes ? true : undefined}
        />
      </FormField>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p
          role={message?.tone === 'error' ? 'alert' : 'status'}
          className={`text-sm ${message?.tone === 'error' ? 'text-rose-700' : message ? 'text-emerald-700' : 'text-slate-500'}`}
        >
          {message?.text ?? `Last updated ${new Date(settings.updated_at).toLocaleString()}`}
        </p>
        <Button type="submit" loading={saving} className="w-full sm:w-auto">
          <Save className="h-4 w-4" aria-hidden="true" />
          Save settings
        </Button>
      </div>
    </form>
  );
}

export function SystemSettingsPage() {
  const { settings, loading, error, reload, setSettings } = useSystemSettings();

  if (loading) return <LoadingState label="Loading settings" />;
  if (error) return <ErrorState message={error} action={<Button variant="secondary" onClick={() => void reload()}>Try again</Button>} />;
  if (!settings) return <EmptyState title="Settings unavailable" description="The system settings record could not be found." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">System settings</h1>
        <p className="mt-1 text-sm text-slate-600">Control-centre-wide options. Only super administrators can change them.</p>
      </div>
      <Panel title="General" className="max-w-2xl">
        <SettingsForm key={settings.updated_at} settings={settings} onSaved={setSettings} />
      </Panel>
    </div>
  );
}
