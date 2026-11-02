/*
# Tighten table grants and make the audit log read-only for clients

1. Plain-English summary
- Every app table had write grants for the anonymous role, even though the app requires sign-in and has no anonymous policies.
- The audit log is written only by the admin access function, so clients should only ever read it.

2. Changes
- Revoke all privileges from the `anon` role on every table in `public`.
- Revoke INSERT, UPDATE and DELETE from `authenticated` on `audit_logs`. SELECT remains, and RLS still limits it to super admins.

3. Security impact
- No row-level policy changes. Access for signed-in users is governed by the existing policies.
- Audit entries can only be created by the SECURITY DEFINER access function.
*/

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t.tablename);
  END LOOP;
END $$;

REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM authenticated;
