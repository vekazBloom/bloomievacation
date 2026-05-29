-- ============================================================================
-- BloomieVacation - Revoke anon EXECUTE on SECURITY DEFINER functions
--
-- Supabase security linter flagged these SECURITY DEFINER functions as callable
-- by the unauthenticated (anon) role via the REST API. None of them are intended
-- to be public — they are internal helpers used by RLS policies, triggers, and
-- server-side logic only.
--
-- Fix: revoke EXECUTE from anon. Authenticated users and service_role retain
-- their grants where needed by RLS policies.
-- ============================================================================

-- Admin / system functions — should never be callable without auth
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()                             FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_leave_balance()                          FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_legacy_grant_days_allocated()            FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_legacy_annual_grant_for_member()       FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_project_dashboard_counts(date, date)    FROM anon;

-- Role-check helpers — expose membership/admin info without authentication
REVOKE EXECUTE ON FUNCTION public.is_project_admin(uuid, uuid)                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_project_lead(uuid, uuid)                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_project_member(uuid, uuid)                 FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_system_admin(uuid)                         FROM anon;
