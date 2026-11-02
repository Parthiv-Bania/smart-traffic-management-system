/*
# Restrict profile writes to the display name and remove destructive table grants

1. Plain-English summary
- Signed-in users could update every column on their own profile row, including their role and active flag. RLS only checked the row owner, so a user could have promoted themselves.
- Signed-in users also held TRUNCATE, which bypasses row-level security and could empty whole tables.

2. Changes to profiles
- Revoke table-wide UPDATE, INSERT and DELETE from `authenticated`.
- Grant UPDATE on `full_name` only. Role, active status and audit fields are changed only through the admin access function.

3. Changes to all public tables
- Revoke TRUNCATE, REFERENCES and TRIGGER from `authenticated`. The app never needs them, and row-level security does not guard TRUNCATE.

4. Security impact
- Role and access changes now require the super admin access function, which checks the caller and writes an audit entry.
*/

REVOKE UPDATE, INSERT, DELETE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name) ON public.profiles TO authenticated;

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM authenticated', t.tablename);
  END LOOP;
END $$;
