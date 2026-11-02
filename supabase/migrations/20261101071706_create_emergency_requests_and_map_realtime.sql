/*
# Persist emergency priority requests and enable live map updates

1. Plain-English summary
- Each emergency priority request made in the live simulation is now saved, so the traffic map can show it.
- The map receives live updates when requests, incidents, or intersections change.
- Requests are simulated. No real vehicle or signal is connected.

2. New table: emergency_requests
- id (uuid, primary key)
- intersection_id (uuid): the intersection where the request was made. Removed with the intersection.
- approach_name (text): the approach the emergency vehicle is requesting, such as North.
- status (text): active while the request is in progress, cleared once the path has been served or cancelled.
- requested_by (uuid): the user who made the request. Filled from the signed-in user.
- requested_at (timestamptz): when the request started.
- cleared_at (timestamptz, optional): when the request ended. Required once cleared.

3. Realtime
- emergency_requests, incidents, and intersections are added to live updates so open maps refresh automatically.

4. Security
- Row-level security is enabled.
- Every signed-in user with an active role can read requests.
- Users with simulation access can create requests, but only as themselves.
- Users with simulation access can mark a request cleared. Requests cannot be deleted.
*/

CREATE TABLE IF NOT EXISTS public.emergency_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intersection_id uuid NOT NULL REFERENCES public.intersections(id) ON DELETE CASCADE,
  approach_name text NOT NULL CHECK (char_length(approach_name) BETWEEN 1 AND 40),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cleared')),
  requested_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  cleared_at timestamptz,
  CONSTRAINT emergency_requests_cleared_consistent CHECK ((status = 'cleared') = (cleared_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS emergency_requests_status_requested_idx ON public.emergency_requests (status, requested_at DESC);
CREATE INDEX IF NOT EXISTS emergency_requests_intersection_idx ON public.emergency_requests (intersection_id);

ALTER TABLE public.emergency_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.emergency_requests FROM anon;
GRANT SELECT, INSERT ON public.emergency_requests TO authenticated;
GRANT UPDATE (status, cleared_at) ON public.emergency_requests TO authenticated;

DROP POLICY IF EXISTS "emergency_requests_select_active_users" ON public.emergency_requests;
CREATE POLICY "emergency_requests_select_active_users" ON public.emergency_requests FOR SELECT
  TO authenticated USING (public.app_role() IS NOT NULL);

DROP POLICY IF EXISTS "emergency_requests_insert_simulation_users" ON public.emergency_requests;
CREATE POLICY "emergency_requests_insert_simulation_users" ON public.emergency_requests FOR INSERT
  TO authenticated WITH CHECK (
    public.app_role() IN ('super_admin', 'traffic_operator', 'traffic_analyst')
    AND requested_by = auth.uid()
  );

DROP POLICY IF EXISTS "emergency_requests_update_simulation_users" ON public.emergency_requests;
CREATE POLICY "emergency_requests_update_simulation_users" ON public.emergency_requests FOR UPDATE
  TO authenticated
  USING (public.app_role() IN ('super_admin', 'traffic_operator', 'traffic_analyst'))
  WITH CHECK (public.app_role() IN ('super_admin', 'traffic_operator', 'traffic_analyst'));

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['emergency_requests', 'incidents', 'intersections'] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;
