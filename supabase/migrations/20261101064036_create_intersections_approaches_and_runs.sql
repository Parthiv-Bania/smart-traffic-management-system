/*
# Create intersections, approaches, and simulation run records

Plain-English summary
This migration adds the data the traffic platform works on: the monitored intersections, the four road approaches at each one, and a saved record of every simulation run (including the fixed-timing vs adaptive-timing comparisons). Three sample intersections in Indian cities are added so the dashboard has realistic content on first use.

1. New Tables
- `intersections`: one row per monitored junction. Holds its code, name, city, optional coordinates, status (active or inactive), signal control mode (fixed or adaptive), and timing limits in seconds: minimum green, maximum green, yellow, all-red clearance, and fixed-plan green.
- `intersection_approaches`: the roads entering an intersection. Each has a compass name (North, South, East, West), road name, lane count, phase group (A or B; approaches in different groups never receive green together), saturation flow (vehicles per hour per lane), and base arrival rate (vehicles per minute).
- `simulation_runs`: a saved result of one simulated run, including its mode, duration, random seed, traffic intensity, and summary metrics. A shared comparison identifier links the two runs in a fixed-vs-adaptive comparison.

2. Triggers
- `updated_at` on intersections is refreshed automatically on every change.

3. Security
- Row level security is enabled on all three tables.
- Any active signed-in user can read intersections, approaches, and simulation runs.
- Only Super Administrators can create, edit, or delete intersections and approaches.
- Super Administrators, Traffic Operators, and Traffic Analysts can save simulation runs, and only under their own identity.

4. Seed data
- Three sample intersections (Bengaluru, Mumbai, New Delhi), each with four approaches.

5. Important notes
- Idempotent: safe to re-run; seed rows are skipped when their codes already exist.
- No data is removed by this migration.
*/

CREATE TABLE IF NOT EXISTS public.intersections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9-]{3,20}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  city text NOT NULL CHECK (char_length(city) BETWEEN 2 AND 80),
  latitude numeric(9,6) CHECK (latitude BETWEEN -90 AND 90),
  longitude numeric(9,6) CHECK (longitude BETWEEN -180 AND 180),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  control_mode text NOT NULL DEFAULT 'adaptive' CHECK (control_mode IN ('fixed', 'adaptive')),
  min_green_seconds integer NOT NULL DEFAULT 10 CHECK (min_green_seconds BETWEEN 5 AND 120),
  max_green_seconds integer NOT NULL DEFAULT 60 CHECK (max_green_seconds BETWEEN 10 AND 180),
  yellow_seconds integer NOT NULL DEFAULT 3 CHECK (yellow_seconds BETWEEN 2 AND 6),
  all_red_seconds integer NOT NULL DEFAULT 2 CHECK (all_red_seconds BETWEEN 0 AND 5),
  fixed_green_seconds integer NOT NULL DEFAULT 30 CHECK (fixed_green_seconds BETWEEN 5 AND 180),
  created_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT intersections_green_limits CHECK (max_green_seconds >= min_green_seconds)
);

CREATE INDEX IF NOT EXISTS intersections_status_idx ON public.intersections (status);

CREATE TABLE IF NOT EXISTS public.intersection_approaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intersection_id uuid NOT NULL REFERENCES public.intersections(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (name IN ('North', 'South', 'East', 'West')),
  road_name text NOT NULL CHECK (char_length(road_name) BETWEEN 2 AND 120),
  lanes integer NOT NULL CHECK (lanes BETWEEN 1 AND 6),
  phase_group text NOT NULL CHECK (phase_group IN ('A', 'B')),
  saturation_flow_vph integer NOT NULL DEFAULT 1800 CHECK (saturation_flow_vph BETWEEN 600 AND 2400),
  base_arrival_rate numeric(5,1) NOT NULL DEFAULT 12.0 CHECK (base_arrival_rate BETWEEN 0 AND 60),
  UNIQUE (intersection_id, name)
);

CREATE INDEX IF NOT EXISTS intersection_approaches_intersection_idx
  ON public.intersection_approaches (intersection_id);

CREATE TABLE IF NOT EXISTS public.simulation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intersection_id uuid NOT NULL REFERENCES public.intersections(id) ON DELETE CASCADE,
  comparison_id uuid,
  control_mode text NOT NULL CHECK (control_mode IN ('fixed', 'adaptive')),
  duration_seconds integer NOT NULL CHECK (duration_seconds BETWEEN 60 AND 86400),
  random_seed integer NOT NULL,
  traffic_intensity numeric(4,2) NOT NULL CHECK (traffic_intensity BETWEEN 0.1 AND 3.0),
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS simulation_runs_intersection_idx
  ON public.simulation_runs (intersection_id, created_at DESC);
CREATE INDEX IF NOT EXISTS simulation_runs_comparison_idx
  ON public.simulation_runs (comparison_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS intersections_touch_updated_at ON public.intersections;
CREATE TRIGGER intersections_touch_updated_at
  BEFORE UPDATE ON public.intersections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.intersections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intersection_approaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_runs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intersections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intersection_approaches TO authenticated;
GRANT SELECT, INSERT ON public.simulation_runs TO authenticated;

DROP POLICY IF EXISTS "intersections_select_active_users" ON public.intersections;
CREATE POLICY "intersections_select_active_users" ON public.intersections FOR SELECT
  TO authenticated
  USING (public.app_role() IS NOT NULL);

DROP POLICY IF EXISTS "intersections_insert_admin" ON public.intersections;
CREATE POLICY "intersections_insert_admin" ON public.intersections FOR INSERT
  TO authenticated
  WITH CHECK (public.app_role() = 'super_admin' AND created_by = auth.uid());

DROP POLICY IF EXISTS "intersections_update_admin" ON public.intersections;
CREATE POLICY "intersections_update_admin" ON public.intersections FOR UPDATE
  TO authenticated
  USING (public.app_role() = 'super_admin')
  WITH CHECK (public.app_role() = 'super_admin');

DROP POLICY IF EXISTS "intersections_delete_admin" ON public.intersections;
CREATE POLICY "intersections_delete_admin" ON public.intersections FOR DELETE
  TO authenticated
  USING (public.app_role() = 'super_admin');

DROP POLICY IF EXISTS "approaches_select_active_users" ON public.intersection_approaches;
CREATE POLICY "approaches_select_active_users" ON public.intersection_approaches FOR SELECT
  TO authenticated
  USING (public.app_role() IS NOT NULL);

DROP POLICY IF EXISTS "approaches_insert_admin" ON public.intersection_approaches;
CREATE POLICY "approaches_insert_admin" ON public.intersection_approaches FOR INSERT
  TO authenticated
  WITH CHECK (public.app_role() = 'super_admin');

DROP POLICY IF EXISTS "approaches_update_admin" ON public.intersection_approaches;
CREATE POLICY "approaches_update_admin" ON public.intersection_approaches FOR UPDATE
  TO authenticated
  USING (public.app_role() = 'super_admin')
  WITH CHECK (public.app_role() = 'super_admin');

DROP POLICY IF EXISTS "approaches_delete_admin" ON public.intersection_approaches;
CREATE POLICY "approaches_delete_admin" ON public.intersection_approaches FOR DELETE
  TO authenticated
  USING (public.app_role() = 'super_admin');

DROP POLICY IF EXISTS "simulation_runs_select_active_users" ON public.simulation_runs;
CREATE POLICY "simulation_runs_select_active_users" ON public.simulation_runs FOR SELECT
  TO authenticated
  USING (public.app_role() IS NOT NULL);

DROP POLICY IF EXISTS "simulation_runs_insert_staff" ON public.simulation_runs;
CREATE POLICY "simulation_runs_insert_staff" ON public.simulation_runs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.app_role() IN ('super_admin', 'traffic_operator', 'traffic_analyst')
    AND created_by = auth.uid()
  );

INSERT INTO public.intersections
  (code, name, city, latitude, longitude, control_mode, min_green_seconds, max_green_seconds, yellow_seconds, all_red_seconds, fixed_green_seconds)
VALUES
  ('BLR-MGR-01', 'MG Road x Brigade Road', 'Bengaluru', 12.975300, 77.607000, 'adaptive', 10, 60, 3, 2, 30),
  ('MUM-DAD-02', 'Dadar TT Circle', 'Mumbai', 19.018600, 72.842400, 'fixed', 12, 70, 3, 2, 35),
  ('DEL-CP-03', 'Connaught Place Outer Circle', 'New Delhi', 28.631500, 77.217500, 'adaptive', 10, 60, 3, 2, 30)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.intersection_approaches
  (intersection_id, name, road_name, lanes, phase_group, base_arrival_rate)
SELECT i.id, a.name, a.road_name, a.lanes, a.phase_group, a.base_arrival_rate
FROM public.intersections i
JOIN (VALUES
  ('BLR-MGR-01', 'North', 'Brigade Road', 2, 'A', 16.0),
  ('BLR-MGR-01', 'South', 'Residency Road', 2, 'A', 14.0),
  ('BLR-MGR-01', 'East', 'MG Road', 3, 'B', 22.0),
  ('BLR-MGR-01', 'West', 'Church Street', 2, 'B', 12.0),
  ('MUM-DAD-02', 'North', 'Senapati Bapat Marg', 3, 'A', 24.0),
  ('MUM-DAD-02', 'South', 'Tilak Road', 2, 'A', 18.0),
  ('MUM-DAD-02', 'East', 'Dadar Station Road', 2, 'B', 15.0),
  ('MUM-DAD-02', 'West', 'Lala Lajpat Rai Marg', 3, 'B', 20.0),
  ('DEL-CP-03', 'North', 'Parliament Street', 2, 'A', 14.0),
  ('DEL-CP-03', 'South', 'Ashoka Road', 2, 'A', 13.0),
  ('DEL-CP-03', 'East', 'Baba Kharak Singh Marg', 3, 'B', 19.0),
  ('DEL-CP-03', 'West', 'Janpath', 2, 'B', 11.0)
) AS a(code, name, road_name, lanes, phase_group, base_arrival_rate)
  ON a.code = i.code
ON CONFLICT (intersection_id, name) DO NOTHING;
