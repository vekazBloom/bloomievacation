-- ============================================================================
-- Balance sync must run with definer rights: approvers update leave_requests
-- as themselves, but the trigger adjusts the *employee's* global balance row.
-- Without SECURITY DEFINER, RLS on user_leave_balances can block that UPDATE
-- and fail the whole approve transaction (500).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ensure_user_leave_balance(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_leave_balances (
    user_id,
    annual_leave_total,
    annual_leave_carried_over,
    sick_leave_total,
    religious_leave_total
  )
  SELECT
    p_user_id,
    COALESCE(MAX(pm.annual_leave_total), 20),
    COALESCE(MAX(pm.annual_leave_carried_over), 0),
    COALESCE(MAX(pm.sick_leave_total), 10),
    COALESCE(MAX(pm.religious_leave_total), 2)
  FROM public.project_members pm
  WHERE pm.user_id = p_user_id
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_leave_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta NUMERIC := 0;
  v_user_id UUID;
  v_leave_type leave_type;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'approved' THEN
    v_delta := NEW.working_days_count;
    v_user_id := NEW.user_id;
    v_leave_type := NEW.type;
  ELSIF TG_OP = 'UPDATE' THEN
    v_user_id := NEW.user_id;
    v_leave_type := NEW.type;

    IF OLD.status = 'approved' AND NEW.status != 'approved' THEN
      v_delta := -OLD.working_days_count;
      v_leave_type := OLD.type;
    ELSIF OLD.status != 'approved' AND NEW.status = 'approved' THEN
      v_delta := NEW.working_days_count;
    ELSIF OLD.status = 'approved' AND NEW.status = 'approved'
          AND OLD.working_days_count != NEW.working_days_count THEN
      v_delta := NEW.working_days_count - OLD.working_days_count;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'approved' THEN
    v_delta := -OLD.working_days_count;
    v_user_id := OLD.user_id;
    v_leave_type := OLD.type;
  END IF;

  IF v_delta != 0 AND v_user_id IS NOT NULL THEN
    PERFORM public.ensure_user_leave_balance(v_user_id);

    IF v_leave_type = 'annual' THEN
      UPDATE public.user_leave_balances
      SET annual_leave_used = GREATEST(0, annual_leave_used + v_delta)
      WHERE user_id = v_user_id;
    ELSIF v_leave_type = 'sick' THEN
      UPDATE public.user_leave_balances
      SET sick_leave_used = GREATEST(0, sick_leave_used + v_delta)
      WHERE user_id = v_user_id;
    ELSIF v_leave_type = 'religious' THEN
      UPDATE public.user_leave_balances
      SET religious_leave_used = GREATEST(0, religious_leave_used + v_delta)
      WHERE user_id = v_user_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
