-- Per-address toggle: saved addresses can stay on file but opt out of receiving copies.

ALTER TABLE public.user_leave_approval_forward_emails
  ADD COLUMN IF NOT EXISTS send_enabled BOOLEAN NOT NULL DEFAULT TRUE;

CREATE POLICY "user_leave_forward_update_own"
  ON public.user_leave_approval_forward_emails FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
