/*
# Create system settings (single row, super admin edits)

1. New Tables
- `system_settings`: one row holding control-centre-wide settings.
  - `id` (smallint, fixed to 1 so there is only ever one row)
  - `organization_name` (text, 2 to 80 characters) shown in the navigation
  - `emergency_display_minutes` (integer, 5 to 60) how long an emergency request stays on the traffic map
  - `updated_at`, `updated_by` record the last change

2. Security
- Row level security enabled.
- Every signed-in role can read the settings (the map and navigation need them).
- Only `super_admin` can change them; the update must be stamped with the caller's own id.
- No insert or delete policies: the seeded row is the only row.
- Column-restricted UPDATE grant so the id and audit fields cannot be altered directly.

3. Notes
- Seeds the default row so reads always return exactly one row.
*/

CREATE TABLE IF NOT EXISTS system_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  organization_name text NOT NULL DEFAULT 'Traffic Control Centre' CHECK (char_length(organization_name) BETWEEN 2 AND 80),
  emergency_display_minutes integer NOT NULL DEFAULT 15 CHECK (emergency_display_minutes BETWEEN 5 AND 60),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO system_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON system_settings TO authenticated;
GRANT UPDATE (organization_name, emergency_display_minutes, updated_at, updated_by) ON system_settings TO authenticated;

DROP POLICY IF EXISTS "select_system_settings" ON system_settings;
CREATE POLICY "select_system_settings" ON system_settings FOR SELECT
  TO authenticated
  USING (app_role() IN ('super_admin', 'traffic_operator', 'traffic_analyst', 'viewer'));

DROP POLICY IF EXISTS "update_system_settings" ON system_settings;
CREATE POLICY "update_system_settings" ON system_settings FOR UPDATE
  TO authenticated
  USING (app_role() = 'super_admin')
  WITH CHECK (app_role() = 'super_admin' AND updated_by = auth.uid());
