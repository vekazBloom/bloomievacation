-- ============================================================================
-- Jira analytics MVP schema
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.jira_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_url TEXT NOT NULL,
  project_key TEXT NOT NULL,
  board_id INT NOT NULL,
  jira_email TEXT NOT NULL,
  jira_api_token TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT jira_connections_singleton CHECK (id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_jira_connections_singleton
  ON public.jira_connections ((true));

CREATE TABLE IF NOT EXISTS public.jira_user_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  app_user_email TEXT NOT NULL,
  jira_account_id TEXT NOT NULL,
  jira_display_name TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(app_user_id),
  UNIQUE(jira_account_id)
);

CREATE INDEX IF NOT EXISTS idx_jira_user_mappings_app_email
  ON public.jira_user_mappings (app_user_email);

CREATE TABLE IF NOT EXISTS public.jira_sprint_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id INT NOT NULL,
  sprint_id INT NOT NULL,
  sprint_name TEXT NOT NULL,
  sprint_state TEXT NOT NULL,
  sprint_start TIMESTAMPTZ,
  sprint_end TIMESTAMPTZ,
  sprint_complete TIMESTAMPTZ,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scope_total INT NOT NULL DEFAULT 0,
  completed_total INT NOT NULL DEFAULT 0,
  carry_over_total INT NOT NULL DEFAULT 0,
  completion_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  todo_total INT NOT NULL DEFAULT 0,
  qa_ready_total INT NOT NULL DEFAULT 0,
  qa_rejected_total INT NOT NULL DEFAULT 0,
  done_total INT NOT NULL DEFAULT 0,
  synced_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(board_id, sprint_id)
);

CREATE TABLE IF NOT EXISTS public.jira_sprint_user_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id INT NOT NULL,
  sprint_id INT NOT NULL,
  app_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  jira_account_id TEXT NOT NULL,
  jira_display_name TEXT,
  issue_count INT NOT NULL DEFAULT 0,
  qa_ready_to_done_count INT NOT NULL DEFAULT 0,
  qa_ready_to_rejected_count INT NOT NULL DEFAULT 0,
  tracked_time_seconds INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(board_id, sprint_id, app_user_id)
);

ALTER TABLE public.jira_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jira_user_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jira_sprint_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jira_sprint_user_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jira_connections_select_sysadmin"
  ON public.jira_connections FOR SELECT TO authenticated
  USING (public.is_system_admin(auth.uid()));

CREATE POLICY "jira_connections_insert_sysadmin"
  ON public.jira_connections FOR INSERT TO authenticated
  WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "jira_connections_update_sysadmin"
  ON public.jira_connections FOR UPDATE TO authenticated
  USING (public.is_system_admin(auth.uid()));

CREATE POLICY "jira_user_mappings_select_sysadmin"
  ON public.jira_user_mappings FOR SELECT TO authenticated
  USING (public.is_system_admin(auth.uid()));

CREATE POLICY "jira_user_mappings_insert_sysadmin"
  ON public.jira_user_mappings FOR INSERT TO authenticated
  WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "jira_user_mappings_update_sysadmin"
  ON public.jira_user_mappings FOR UPDATE TO authenticated
  USING (public.is_system_admin(auth.uid()));

CREATE POLICY "jira_user_mappings_delete_sysadmin"
  ON public.jira_user_mappings FOR DELETE TO authenticated
  USING (public.is_system_admin(auth.uid()));

CREATE POLICY "jira_sprint_snapshots_select_authenticated"
  ON public.jira_sprint_snapshots FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "jira_sprint_snapshots_insert_sysadmin"
  ON public.jira_sprint_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "jira_sprint_snapshots_update_sysadmin"
  ON public.jira_sprint_snapshots FOR UPDATE TO authenticated
  USING (public.is_system_admin(auth.uid()));

CREATE POLICY "jira_sprint_user_metrics_select_self_or_sysadmin"
  ON public.jira_sprint_user_metrics FOR SELECT TO authenticated
  USING (app_user_id = auth.uid() OR public.is_system_admin(auth.uid()));

CREATE POLICY "jira_sprint_user_metrics_insert_sysadmin"
  ON public.jira_sprint_user_metrics FOR INSERT TO authenticated
  WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "jira_sprint_user_metrics_update_sysadmin"
  ON public.jira_sprint_user_metrics FOR UPDATE TO authenticated
  USING (public.is_system_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.set_jira_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_jira_connections_updated_at
  BEFORE UPDATE ON public.jira_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_jira_updated_at();

CREATE TRIGGER set_jira_user_mappings_updated_at
  BEFORE UPDATE ON public.jira_user_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_jira_updated_at();

CREATE TRIGGER set_jira_sprint_snapshots_updated_at
  BEFORE UPDATE ON public.jira_sprint_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_jira_updated_at();

CREATE TRIGGER set_jira_sprint_user_metrics_updated_at
  BEFORE UPDATE ON public.jira_sprint_user_metrics
  FOR EACH ROW EXECUTE FUNCTION public.set_jira_updated_at();
