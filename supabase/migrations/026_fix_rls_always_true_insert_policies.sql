-- ============================================================================
-- BloomieVacation - Fix RLS WITH CHECK (true) on INSERT policies
--
-- Supabase security linter flagged two tables whose INSERT policies use
-- WITH CHECK (true), meaning any authenticated user could insert arbitrary rows.
--
-- leave_request_history
--   Inserts happen from API route handlers using the authenticated client.
--   The existing WITH CHECK (true) lets any authenticated user create fake
--   audit entries for any leave request. Fix: require the inserter to be the
--   authenticated user (performed_by = auth.uid()) AND to be a valid
--   participant of the related leave request (owner / project lead / admin).
--
-- notifications
--   Every code path that creates notifications uses the service-role client
--   (createServiceClient). Authenticated users never need direct INSERT access.
--   Fix: drop the permissive policy entirely — service_role bypasses RLS.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- leave_request_history
-- ----------------------------------------------------------------------------

-- Drop the original permissive policy (initial schema) and any prior attempt.
DROP POLICY IF EXISTS "history_insert_authenticated" ON public.leave_request_history;
DROP POLICY IF EXISTS "history_insert_authorized"   ON public.leave_request_history;

-- New policy: the inserter must be acting as themselves AND must be the leave
-- request owner, a project lead, or a system admin on that request.
CREATE POLICY "history_insert_authorized" ON public.leave_request_history
  FOR INSERT TO authenticated
  WITH CHECK (
    performed_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.leave_requests lr
      WHERE lr.id = request_id
        AND (
          lr.user_id = auth.uid()
          OR public.is_system_admin(auth.uid())
          OR public.is_project_lead(lr.project_id, auth.uid())
        )
    )
  );


-- ----------------------------------------------------------------------------
-- notifications
-- ----------------------------------------------------------------------------

-- All notification inserts go through createInAppNotification() which is
-- always called with a service-role client — service_role bypasses RLS so no
-- INSERT policy is needed for that role. Authenticated users should never be
-- able to create their own (or others') notifications directly.
DROP POLICY IF EXISTS "notifications_insert_authenticated" ON public.notifications;
