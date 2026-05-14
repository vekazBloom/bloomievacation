-- Platform invitations: optional project, optional system-admin grant.
-- project_id NULL = invite to the app only (no project membership unless combined with optional project in same row).

ALTER TABLE public.invitations
  ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS grant_system_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Invitations RLS: project admins only when project_id is set; system admins always.
DROP POLICY IF EXISTS "invites_select_admin" ON public.invitations;
CREATE POLICY "invites_select_admin" ON public.invitations
  FOR SELECT TO authenticated USING (
    public.is_system_admin(auth.uid())
    OR (
      project_id IS NOT NULL
      AND public.is_project_admin(project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "invites_insert_admin" ON public.invitations;
CREATE POLICY "invites_insert_admin" ON public.invitations
  FOR INSERT TO authenticated WITH CHECK (
    public.is_system_admin(auth.uid())
    OR (
      project_id IS NOT NULL
      AND public.is_project_admin(project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "invites_update_admin" ON public.invitations;
CREATE POLICY "invites_update_admin" ON public.invitations
  FOR UPDATE TO authenticated USING (
    public.is_system_admin(auth.uid())
    OR (
      project_id IS NOT NULL
      AND public.is_project_admin(project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "invites_delete_admin" ON public.invitations;
CREATE POLICY "invites_delete_admin" ON public.invitations
  FOR DELETE TO authenticated USING (
    public.is_system_admin(auth.uid())
    OR (
      project_id IS NOT NULL
      AND public.is_project_admin(project_id, auth.uid())
    )
  );
