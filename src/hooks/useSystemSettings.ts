import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface SystemSettings {
  organization_name: string;
  emergency_display_minutes: number;
  updated_at: string;
}

export const DEFAULT_EMERGENCY_DISPLAY_MINUTES = 15;

const LOAD_ERROR = 'System settings could not be loaded.';

function isSettingsRow(value: unknown): value is SystemSettings {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.organization_name === 'string' &&
    typeof row.emergency_display_minutes === 'number' &&
    typeof row.updated_at === 'string'
  );
}

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from('system_settings')
      .select('organization_name, emergency_display_minutes, updated_at')
      .eq('id', 1)
      .maybeSingle();
    if (queryError || (data !== null && !isSettingsRow(data))) {
      setError(LOAD_ERROR);
    } else {
      setSettings(data);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { settings, loading, error, reload, setSettings };
}
