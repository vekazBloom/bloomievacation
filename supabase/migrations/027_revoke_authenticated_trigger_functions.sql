-- ============================================================================
-- BloomieVacation - #5: Revoke authenticated EXECUTE on trigger-only
--                       SECURITY DEFINER functions
--
-- These functions are invoked exclusively by database triggers or the
-- service-role. No application code calls them directly via the REST API.
-- Leaving EXECUTE open to the authenticated role means any logged-in user
-- can call them at will through /rest/v1/rpc/<name>.
--
-- Functions that MUST stay callable by authenticated are kept:
--   • is_project_admin / is_project_lead / is_project_member / is_system_admin
--     → used inside RLS policies which run as the calling user
--   • admin_project_dashboard_counts
--     → called from server-side app code using the user's JWT; the function
--       enforces its own auth.uid() IS system-admin guard internally
-- ============================================================================

-- Trigger function: fires on leave_requests INSERT/UPDATE/DELETE to sync balances
REVOKE EXECUTE ON FUNCTION public.sync_leave_balance()                      FROM authenticated;

-- Trigger function: fires on project_members INSERT to create legacy grant row
REVOKE EXECUTE ON FUNCTION public.ensure_legacy_annual_grant_for_member()   FROM authenticated;

-- Trigger function: fires on project_members UPDATE to keep legacy grant in sync
REVOKE EXECUTE ON FUNCTION public.sync_legacy_grant_days_allocated()        FROM authenticated;

-- Supabase internal utility — never called by application code
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()                         FROM authenticated;
