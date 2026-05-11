-- ============================================================================
-- BloomieVacation - Initial Schema Migration
-- ============================================================================
-- Run this in Supabase SQL Editor: https://app.supabase.com → SQL Editor
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE project_role AS ENUM ('admin', 'lead', 'employee');
CREATE TYPE leave_type AS ENUM ('annual', 'sick', 'religious');
CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE carry_over_policy AS ENUM ('ask', 'auto_transfer', 'auto_lose');
CREATE TYPE religion_category AS ENUM (
  'islam',
  'christianity_catholic',
  'christianity_orthodox',
  'judaism',
  'hinduism',
  'buddhism',
  'other'
);
CREATE TYPE notification_type AS ENUM (
  'invite_received',
  'request_submitted',
  'request_approved',
  'request_rejected',
  'request_edited',
  'religious_holiday_logged',
  'carry_over_warning',
  'project_added'
);

-- ============================================================================
-- USERS (extends auth.users via id)
-- ============================================================================

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  is_system_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON public.users(email);

-- ============================================================================
-- PROJECTS
-- ============================================================================

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  vacation_threshold_percent INT DEFAULT 50 CHECK (vacation_threshold_percent BETWEEN 1 AND 100),
  year_reset_month INT DEFAULT 1 CHECK (year_reset_month BETWEEN 1 AND 12),
  year_reset_day INT DEFAULT 1 CHECK (year_reset_day BETWEEN 1 AND 31),
  carry_over_policy carry_over_policy DEFAULT 'ask',
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_created_by ON public.projects(created_by);
CREATE INDEX idx_projects_is_archived ON public.projects(is_archived);

-- ============================================================================
-- PROJECT MEMBERS (with per-project leave balances)
-- ============================================================================

CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role project_role NOT NULL DEFAULT 'employee',
  annual_leave_total INT DEFAULT 20 CHECK (annual_leave_total >= 0),
  annual_leave_used NUMERIC(5,1) DEFAULT 0 CHECK (annual_leave_used >= 0),
  annual_leave_carried_over NUMERIC(5,1) DEFAULT 0 CHECK (annual_leave_carried_over >= 0),
  sick_leave_total INT DEFAULT 30 CHECK (sick_leave_total >= 0),
  sick_leave_used NUMERIC(5,1) DEFAULT 0 CHECK (sick_leave_used >= 0),
  religious_leave_total INT DEFAULT 3 CHECK (religious_leave_total >= 0),
  religious_leave_used NUMERIC(5,1) DEFAULT 0 CHECK (religious_leave_used >= 0),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_project ON public.project_members(project_id);
CREATE INDEX idx_project_members_user ON public.project_members(user_id);
CREATE INDEX idx_project_members_role ON public.project_members(project_id, role);

-- ============================================================================
-- NATIONAL HOLIDAYS (global)
-- ============================================================================

CREATE TABLE public.national_holidays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_national_holidays_date ON public.national_holidays(date);

-- ============================================================================
-- RELIGIOUS HOLIDAYS POOL (global)
-- ============================================================================

CREATE TABLE public.religious_holidays_pool (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  category religion_category NOT NULL,
  description TEXT,
  is_recurring BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_religious_holidays_date ON public.religious_holidays_pool(date);
CREATE INDEX idx_religious_holidays_category ON public.religious_holidays_pool(category);

-- ============================================================================
-- USER RELIGIOUS SELECTIONS (per year, resets annually)
-- ============================================================================

CREATE TABLE public.user_religious_selections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  religious_holiday_id UUID NOT NULL REFERENCES public.religious_holidays_pool(id) ON DELETE CASCADE,
  year INT NOT NULL,
  selected_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, religious_holiday_id, year)
);

CREATE INDEX idx_user_religious_user ON public.user_religious_selections(user_id, year);

-- ============================================================================
-- LEAVE REQUESTS
-- ============================================================================

CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type leave_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  working_days_count NUMERIC(5,1) NOT NULL,
  status leave_status NOT NULL DEFAULT 'pending',
  reason TEXT,
  attachment_url TEXT,
  decided_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE INDEX idx_leave_requests_user ON public.leave_requests(user_id);
CREATE INDEX idx_leave_requests_project ON public.leave_requests(project_id);
CREATE INDEX idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX idx_leave_requests_dates ON public.leave_requests(project_id, start_date, end_date);

-- ============================================================================
-- LEAVE REQUEST HISTORY (audit log)
-- ============================================================================

CREATE TABLE public.leave_request_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leave_history_request ON public.leave_request_history(request_id);

-- ============================================================================
-- INVITATIONS
-- ============================================================================

CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  role project_role NOT NULL DEFAULT 'employee',
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  sent_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE INDEX idx_invitations_project ON public.invitations(project_id);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  metadata JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id) WHERE read_at IS NULL;

-- ============================================================================
-- CARRY OVER DECISIONS (year-end)
-- ============================================================================

CREATE TABLE public.carry_over_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  year INT NOT NULL,
  annual_days_remaining NUMERIC(5,1) NOT NULL,
  decision TEXT CHECK (decision IN ('transferred', 'lost', 'pending')),
  decided_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, project_id, year)
);

CREATE INDEX idx_carry_over_user ON public.carry_over_decisions(user_id, year);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Calculate working days between two dates, excluding weekends and national holidays
CREATE OR REPLACE FUNCTION public.calculate_working_days(
  p_start DATE,
  p_end DATE
) RETURNS NUMERIC AS $$
DECLARE
  v_days NUMERIC := 0;
  v_current DATE := p_start;
  v_dow INT;
  v_is_holiday BOOLEAN;
BEGIN
  WHILE v_current <= p_end LOOP
    v_dow := EXTRACT(DOW FROM v_current);
    -- 0 = Sunday, 6 = Saturday
    IF v_dow != 0 AND v_dow != 6 THEN
      -- Check if this date is a national holiday (recurring uses month+day; non-recurring uses exact date)
      SELECT EXISTS(
        SELECT 1 FROM public.national_holidays nh
        WHERE (nh.is_recurring = TRUE
               AND EXTRACT(MONTH FROM nh.date) = EXTRACT(MONTH FROM v_current)
               AND EXTRACT(DAY FROM nh.date) = EXTRACT(DAY FROM v_current))
           OR (nh.is_recurring = FALSE AND nh.date = v_current)
      ) INTO v_is_holiday;

      IF NOT v_is_holiday THEN
        v_days := v_days + 1;
      END IF;
    END IF;
    v_current := v_current + INTERVAL '1 day';
  END LOOP;
  RETURN v_days;
END;
$$ LANGUAGE plpgsql STABLE;

-- Check overlap percentage with already-approved annual leave in a project
CREATE OR REPLACE FUNCTION public.check_vacation_overlap(
  p_project_id UUID,
  p_start DATE,
  p_end DATE,
  p_exclude_request_id UUID DEFAULT NULL
) RETURNS TABLE (
  total_members INT,
  overlapping_members INT,
  overlapping_user_ids UUID[],
  threshold_percent INT
) AS $$
DECLARE
  v_threshold INT;
  v_total INT;
BEGIN
  SELECT vacation_threshold_percent INTO v_threshold
  FROM public.projects WHERE id = p_project_id;

  SELECT COUNT(*) INTO v_total
  FROM public.project_members WHERE project_id = p_project_id;

  RETURN QUERY
  SELECT
    v_total,
    (SELECT COUNT(DISTINCT lr.user_id)::INT FROM public.leave_requests lr
      WHERE lr.project_id = p_project_id
        AND lr.type = 'annual'
        AND lr.status = 'approved'
        AND lr.start_date <= p_end
        AND lr.end_date >= p_start
        AND (p_exclude_request_id IS NULL OR lr.id != p_exclude_request_id)),
    ARRAY(SELECT DISTINCT lr.user_id FROM public.leave_requests lr
      WHERE lr.project_id = p_project_id
        AND lr.type = 'annual'
        AND lr.status = 'approved'
        AND lr.start_date <= p_end
        AND lr.end_date >= p_start
        AND (p_exclude_request_id IS NULL OR lr.id != p_exclude_request_id)),
    v_threshold;
END;
$$ LANGUAGE plpgsql STABLE;

-- Update used balance when leave request changes status
CREATE OR REPLACE FUNCTION public.sync_leave_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_delta NUMERIC := 0;
BEGIN
  -- Calculate delta based on status transition
  IF TG_OP = 'INSERT' AND NEW.status = 'approved' THEN
    v_delta := NEW.working_days_count;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'approved' AND NEW.status != 'approved' THEN
      v_delta := -OLD.working_days_count;
    ELSIF OLD.status != 'approved' AND NEW.status = 'approved' THEN
      v_delta := NEW.working_days_count;
    ELSIF OLD.status = 'approved' AND NEW.status = 'approved'
          AND OLD.working_days_count != NEW.working_days_count THEN
      v_delta := NEW.working_days_count - OLD.working_days_count;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'approved' THEN
    v_delta := -OLD.working_days_count;
  END IF;

  IF v_delta != 0 THEN
    IF (TG_OP = 'DELETE') THEN
      IF OLD.type = 'annual' THEN
        UPDATE public.project_members
        SET annual_leave_used = GREATEST(0, annual_leave_used + v_delta)
        WHERE project_id = OLD.project_id AND user_id = OLD.user_id;
      ELSIF OLD.type = 'sick' THEN
        UPDATE public.project_members
        SET sick_leave_used = GREATEST(0, sick_leave_used + v_delta)
        WHERE project_id = OLD.project_id AND user_id = OLD.user_id;
      ELSIF OLD.type = 'religious' THEN
        UPDATE public.project_members
        SET religious_leave_used = GREATEST(0, religious_leave_used + v_delta)
        WHERE project_id = OLD.project_id AND user_id = OLD.user_id;
      END IF;
    ELSE
      IF NEW.type = 'annual' THEN
        UPDATE public.project_members
        SET annual_leave_used = GREATEST(0, annual_leave_used + v_delta)
        WHERE project_id = NEW.project_id AND user_id = NEW.user_id;
      ELSIF NEW.type = 'sick' THEN
        UPDATE public.project_members
        SET sick_leave_used = GREATEST(0, sick_leave_used + v_delta)
        WHERE project_id = NEW.project_id AND user_id = NEW.user_id;
      ELSIF NEW.type = 'religious' THEN
        UPDATE public.project_members
        SET religious_leave_used = GREATEST(0, religious_leave_used + v_delta)
        WHERE project_id = NEW.project_id AND user_id = NEW.user_id;
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_leave_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.sync_leave_balance();

-- Helper: check if user is project admin
CREATE OR REPLACE FUNCTION public.is_project_admin(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = p_user_id AND role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: check if user is project lead
CREATE OR REPLACE FUNCTION public.is_project_lead(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = p_user_id AND role IN ('admin', 'lead')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: check if user is project member
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = p_user_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: check if user is system admin
CREATE OR REPLACE FUNCTION public.is_system_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT is_system_admin FROM public.users WHERE id = p_user_id), FALSE);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.national_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.religious_holidays_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_religious_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_request_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carry_over_decisions ENABLE ROW LEVEL SECURITY;

-- USERS policies
CREATE POLICY "users_select_all" ON public.users
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "users_update_self" ON public.users
  FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "users_insert_self" ON public.users
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- PROJECTS policies
CREATE POLICY "projects_select_members_or_sysadmin" ON public.projects
  FOR SELECT TO authenticated USING (
    public.is_system_admin(auth.uid()) OR public.is_project_member(id, auth.uid())
  );

CREATE POLICY "projects_insert_sysadmin" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "projects_update_admin" ON public.projects
  FOR UPDATE TO authenticated USING (
    public.is_system_admin(auth.uid()) OR public.is_project_admin(id, auth.uid())
  );

CREATE POLICY "projects_delete_sysadmin" ON public.projects
  FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- PROJECT_MEMBERS policies
CREATE POLICY "members_select_same_project" ON public.project_members
  FOR SELECT TO authenticated USING (
    public.is_system_admin(auth.uid()) OR public.is_project_member(project_id, auth.uid())
  );

CREATE POLICY "members_insert_admin" ON public.project_members
  FOR INSERT TO authenticated WITH CHECK (
    public.is_system_admin(auth.uid()) OR public.is_project_admin(project_id, auth.uid())
  );

CREATE POLICY "members_update_admin" ON public.project_members
  FOR UPDATE TO authenticated USING (
    public.is_system_admin(auth.uid()) OR public.is_project_admin(project_id, auth.uid())
  );

CREATE POLICY "members_delete_admin" ON public.project_members
  FOR DELETE TO authenticated USING (
    public.is_system_admin(auth.uid()) OR public.is_project_admin(project_id, auth.uid())
  );

-- NATIONAL_HOLIDAYS policies (everyone reads, only sysadmin writes)
CREATE POLICY "holidays_select_all" ON public.national_holidays
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "holidays_insert_sysadmin" ON public.national_holidays
  FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "holidays_update_sysadmin" ON public.national_holidays
  FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

CREATE POLICY "holidays_delete_sysadmin" ON public.national_holidays
  FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- RELIGIOUS_HOLIDAYS_POOL policies (everyone reads, only sysadmin writes)
CREATE POLICY "religious_select_all" ON public.religious_holidays_pool
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "religious_insert_sysadmin" ON public.religious_holidays_pool
  FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "religious_update_sysadmin" ON public.religious_holidays_pool
  FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

CREATE POLICY "religious_delete_sysadmin" ON public.religious_holidays_pool
  FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- USER_RELIGIOUS_SELECTIONS policies (user manages own, project members can see for visibility)
CREATE POLICY "religious_sel_select" ON public.user_religious_selections
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "religious_sel_insert_self" ON public.user_religious_selections
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "religious_sel_delete_self" ON public.user_religious_selections
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- LEAVE_REQUESTS policies
CREATE POLICY "leave_select_project_members" ON public.leave_requests
  FOR SELECT TO authenticated USING (
    public.is_system_admin(auth.uid()) OR public.is_project_member(project_id, auth.uid())
  );

CREATE POLICY "leave_insert_self" ON public.leave_requests
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND public.is_project_member(project_id, auth.uid())
  );

CREATE POLICY "leave_update_self_or_lead" ON public.leave_requests
  FOR UPDATE TO authenticated USING (
    user_id = auth.uid()
    OR public.is_system_admin(auth.uid())
    OR public.is_project_lead(project_id, auth.uid())
  );

CREATE POLICY "leave_delete_self_or_admin" ON public.leave_requests
  FOR DELETE TO authenticated USING (
    user_id = auth.uid()
    OR public.is_system_admin(auth.uid())
    OR public.is_project_admin(project_id, auth.uid())
  );

-- LEAVE_REQUEST_HISTORY policies
CREATE POLICY "history_select_project_members" ON public.leave_request_history
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.leave_requests lr
      WHERE lr.id = request_id
        AND (public.is_system_admin(auth.uid()) OR public.is_project_member(lr.project_id, auth.uid()))
    )
  );

CREATE POLICY "history_insert_authenticated" ON public.leave_request_history
  FOR INSERT TO authenticated WITH CHECK (TRUE);

-- INVITATIONS policies (admins manage; invitee can read by token via service role)
CREATE POLICY "invites_select_admin" ON public.invitations
  FOR SELECT TO authenticated USING (
    public.is_system_admin(auth.uid()) OR public.is_project_admin(project_id, auth.uid())
  );

CREATE POLICY "invites_insert_admin" ON public.invitations
  FOR INSERT TO authenticated WITH CHECK (
    public.is_system_admin(auth.uid()) OR public.is_project_admin(project_id, auth.uid())
  );

CREATE POLICY "invites_update_admin" ON public.invitations
  FOR UPDATE TO authenticated USING (
    public.is_system_admin(auth.uid()) OR public.is_project_admin(project_id, auth.uid())
  );

CREATE POLICY "invites_delete_admin" ON public.invitations
  FOR DELETE TO authenticated USING (
    public.is_system_admin(auth.uid()) OR public.is_project_admin(project_id, auth.uid())
  );

-- NOTIFICATIONS policies
CREATE POLICY "notifications_select_self" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "notifications_update_self" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "notifications_insert_authenticated" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (TRUE);

-- CARRY_OVER_DECISIONS policies
CREATE POLICY "carryover_select_self_or_admin" ON public.carry_over_decisions
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR public.is_system_admin(auth.uid())
    OR public.is_project_admin(project_id, auth.uid())
  );

CREATE POLICY "carryover_insert_admin" ON public.carry_over_decisions
  FOR INSERT TO authenticated WITH CHECK (
    public.is_system_admin(auth.uid()) OR public.is_project_admin(project_id, auth.uid())
  );

CREATE POLICY "carryover_update_self_or_admin" ON public.carry_over_decisions
  FOR UPDATE TO authenticated USING (
    user_id = auth.uid()
    OR public.is_system_admin(auth.uid())
    OR public.is_project_admin(project_id, auth.uid())
  );

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', TRUE, 2097152, ARRAY['image/jpeg','image/png','image/webp']),
  ('project-logos', 'project-logos', TRUE, 2097152, ARRAY['image/jpeg','image/png','image/webp']),
  ('sick-leave-attachments', 'sick-leave-attachments', FALSE, 5242880, ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies: avatars (public read, owner write)
CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Storage policies: project-logos (public read, sysadmin write)
CREATE POLICY "logos_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'project-logos');

CREATE POLICY "logos_sysadmin_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-logos' AND public.is_system_admin(auth.uid()));

CREATE POLICY "logos_sysadmin_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'project-logos' AND public.is_system_admin(auth.uid()));

CREATE POLICY "logos_sysadmin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-logos' AND public.is_system_admin(auth.uid()));

-- Storage policies: sick-leave-attachments (private, owner + project leads can read)
CREATE POLICY "sick_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sick-leave-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "sick_owner_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'sick-leave-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "sick_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'sick-leave-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- DONE
-- ============================================================================
-- Next: run 001_seed_admin_and_holidays.sql to seed initial data.
