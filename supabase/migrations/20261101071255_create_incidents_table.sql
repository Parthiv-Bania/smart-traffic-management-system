/*
# Create incidents table for accidents, road closures and maintenance

1. Plain-English summary
- Adds a log of traffic incidents. Each entry is an accident, a road closure, or a maintenance job.
- An incident can be tied to one intersection, or left blank for a citywide or area-wide event.
- Each incident has a severity and a workflow status: open, in progress, or resolved.

2. New table: incidents
- id (uuid, primary key)
- intersection_id (uuid, optional): the intersection affected. Set to empty if the intersection is deleted.
- kind (text): accident, road_closure, or maintenance.
- title (text): short summary, 3 to 120 characters.
- description (text): details, up to 2000 characters.
- severity (text): low, medium, high, or critical. Defaults to medium.
- status (text): open, in_progress, or resolved. Defaults to open.
- starts_at (timestamptz): when the event began or is scheduled to begin.
- ends_at (timestamptz, optional): when it ended or is expected to end. Must not be earlier than starts_at.
- reported_by (uuid): the user who logged the incident. Filled automatically from the signed-in user.
- created_at, updated_at (timestamptz).

3. Security
- Row-level security is enabled.
- Every signed-in user with an active role can read incidents.
- Super Administrators and Traffic Control Operators can log incidents and update them.
- Only Super Administrators can delete incidents.
- Updates are limited to the editable columns; the reporter and creation time cannot be changed.
- Viewers and analysts have read-only access.

4. Notes
- Existing tables are not changed.
*/

CREATE TABLE IF NOT EXISTS public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intersection_id uuid REFERENCES public.intersections(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('accident', 'road_closure', 'maintenance')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  reported_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incidents_end_after_start CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS incidents_intersection_id_idx ON public.incidents (intersection_id);
CREATE INDEX IF NOT EXISTS incidents_status_starts_at_idx ON public.incidents (status, starts_at DESC);

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.incidents FROM anon;
GRANT SELECT, INSERT, DELETE ON public.incidents TO authenticated;
GRANT UPDATE (intersection_id, kind, title, description, severity, status, starts_at, ends_at, updated_at)
  ON public.incidents TO authenticated;

DROP POLICY IF EXISTS "incidents_select_active_users" ON public.incidents;
CREATE POLICY "incidents_select_active_users" ON public.incidents FOR SELECT
  TO authenticated USING (public.app_role() IS NOT NULL);

DROP POLICY IF EXISTS "incidents_insert_staff" ON public.incidents;
CREATE POLICY "incidents_insert_staff" ON public.incidents FOR INSERT
  TO authenticated WITH CHECK (
    public.app_role() IN ('super_admin', 'traffic_operator')
    AND reported_by = auth.uid()
  );

DROP POLICY IF EXISTS "incidents_update_staff" ON public.incidents;
CREATE POLICY "incidents_update_staff" ON public.incidents FOR UPDATE
  TO authenticated
  USING (public.app_role() IN ('super_admin', 'traffic_operator'))
  WITH CHECK (public.app_role() IN ('super_admin', 'traffic_operator'));

DROP POLICY IF EXISTS "incidents_delete_admin" ON public.incidents;
CREATE POLICY "incidents_delete_admin" ON public.incidents FOR DELETE
  TO authenticated USING (public.app_role() = 'super_admin');
