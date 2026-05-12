-- ============================================================================
-- BloomieVacation - Security hardening
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_users_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(auth.role(), '') = 'service_role' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND COALESCE(NEW.is_system_admin, FALSE) THEN
    RAISE EXCEPTION 'System admin status can only be granted by privileged server operations';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.is_system_admin IS DISTINCT FROM OLD.is_system_admin THEN
    RAISE EXCEPTION 'System admin status can only be changed by privileged server operations';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_users_privileged_columns ON public.users;
CREATE TRIGGER enforce_users_privileged_columns
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_users_privileged_columns();

DROP POLICY IF EXISTS "history_insert_authenticated" ON public.leave_request_history;
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

DROP POLICY IF EXISTS "notifications_insert_authenticated" ON public.notifications;
