/*
# Create user profiles, role-based access helpers, and audit log

Plain-English summary
This migration sets up who can use the Smart Traffic Management System and what they are allowed to do. Each sign-in account gets a profile that records a name, an email, a role, and whether the account is active. The first account ever created becomes the Super Administrator; every later account starts as a Viewer. Only a Super Administrator can change roles or activate/deactivate accounts, and every such change is written to an audit log.

1. New Tables
- `profiles`
  - `id` (uuid, primary key, same value as the sign-in account id)
  - `email` (text)
  - `full_name` (text, may be empty)
  - `role` (text: super_admin, traffic_operator, traffic_analyst, viewer)
  - `is_active` (boolean, deactivated accounts lose access to all data)
  - `created_at`, `updated_at` (timestamps)
- `audit_logs`
  - `id` (uuid, primary key)
  - `actor_id` (uuid, the profile who made the change)
  - `action` (text, e.g. user.role_changed)
  - `entity_type`, `entity_id` (text, what was changed)
  - `details` (jsonb, before and after values)
  - `created_at` (timestamp)

2. Functions and triggers
- `handle_new_user()` creates a profile automatically after each sign-up.
- `app_role()` returns the signed-in user's role, or nothing if the account is inactive. All row-access rules use it.
- `admin_set_user_access(target, new_role, new_is_active)` lets only a Super Administrator change another user's role or active state, and writes an audit entry.

3. Security
- Row level security is enabled on both tables.
- Signed-in users can read only their own profile, and Super Administrators can read all profiles.
- Users may change only their own full name. Role and active-state changes can only go through the admin function.
- Audit logs can be read only by Super Administrators. No client can write them directly.
- Functions that are not meant for public calls have their public execute permission removed.

4. Important notes
- Idempotent: safe to re-run. Existing rows are never removed.
- The first-account-becomes-admin rule applies only while no Super Administrator exists.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  full_name text NOT NULL DEFAULT '' CHECK (char_length(full_name) <= 120),
  role text NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('super_admin', 'traffic_operator', 'traffic_analyst', 'viewer')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles (role);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at DESC);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid() AND p.is_active
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE
      WHEN EXISTS (SELECT 1 FROM public.profiles WHERE role = 'super_admin') THEN 'viewer'
      ELSE 'super_admin'
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.admin_set_user_access(
  target uuid,
  new_role text,
  new_is_active boolean
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_role text := public.app_role();
  before_row public.profiles;
  after_row public.profiles;
BEGIN
  IF caller_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Only a Super Administrator can change user access';
  END IF;

  IF new_role NOT IN ('super_admin', 'traffic_operator', 'traffic_analyst', 'viewer') THEN
    RAISE EXCEPTION 'Unknown role: %', new_role;
  END IF;

  SELECT * INTO before_row FROM public.profiles WHERE id = target;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF target = auth.uid() AND (new_role <> 'super_admin' OR NOT new_is_active) THEN
    RAISE EXCEPTION 'You cannot remove your own Super Administrator access';
  END IF;

  IF before_row.role = 'super_admin' AND before_row.is_active
     AND (new_role <> 'super_admin' OR NOT new_is_active)
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles
       WHERE role = 'super_admin' AND is_active AND id <> target
     ) THEN
    RAISE EXCEPTION 'At least one active Super Administrator must remain';
  END IF;

  UPDATE public.profiles
  SET role = new_role, is_active = new_is_active, updated_at = now()
  WHERE id = target
  RETURNING * INTO after_row;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'user.access_changed',
    'profile',
    target::text,
    jsonb_build_object(
      'before', jsonb_build_object('role', before_row.role, 'is_active', before_row.is_active),
      'after', jsonb_build_object('role', after_row.role, 'is_active', after_row.is_active)
    )
  );

  RETURN after_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.app_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_role() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_access(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_access(uuid, text, boolean) TO authenticated;

GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name) ON public.profiles TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;

DROP POLICY IF EXISTS "profiles_select_self_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_self_or_admin" ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.app_role() = 'super_admin');

DROP POLICY IF EXISTS "profiles_update_own_name" ON public.profiles;
CREATE POLICY "profiles_update_own_name" ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.app_role() = 'super_admin');
