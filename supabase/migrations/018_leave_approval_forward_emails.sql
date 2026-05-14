-- Optional CC addresses for approvers: when they approve annual/sick leave, a summary email is sent there.
-- Retro approvals can be sent from Profile → Leave approval forwarding.

CREATE TABLE public.user_leave_approval_forward_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_leave_forward_email_nonempty CHECK (length(trim(email)) > 0)
);

CREATE UNIQUE INDEX user_leave_forward_user_email_lower
  ON public.user_leave_approval_forward_emails (user_id, lower(trim(email)));

CREATE INDEX idx_user_leave_forward_user ON public.user_leave_approval_forward_emails(user_id);

ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS approval_forward_sent_at TIMESTAMPTZ;

ALTER TABLE public.user_leave_approval_forward_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_leave_forward_select_own"
  ON public.user_leave_approval_forward_emails FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "user_leave_forward_insert_own"
  ON public.user_leave_approval_forward_emails FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "user_leave_forward_delete_own"
  ON public.user_leave_approval_forward_emails FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
