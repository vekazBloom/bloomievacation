-- Charge sick/religious against balance_project_id team pool when set.

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
  v_pm_project_id UUID;
  v_pm_user_id UUID;
BEGIN
  v_pm_project_id := NULL;
  v_pm_user_id := NULL;

  IF TG_OP = 'INSERT' AND NEW.status = 'approved' THEN
    v_delta := NEW.working_days_count;
    v_user_id := NEW.user_id;
    v_leave_type := NEW.type;
    v_pm_project_id := COALESCE(NEW.balance_project_id, NEW.project_id);
    v_pm_user_id := NEW.user_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_user_id := NEW.user_id;

    IF OLD.status = 'approved' AND NEW.status != 'approved' THEN
      v_delta := -OLD.working_days_count;
      v_leave_type := OLD.type;
      v_pm_project_id := COALESCE(OLD.balance_project_id, OLD.project_id);
      v_pm_user_id := OLD.user_id;
    ELSIF OLD.status != 'approved' AND NEW.status = 'approved' THEN
      v_delta := NEW.working_days_count;
      v_leave_type := NEW.type;
      v_pm_project_id := COALESCE(NEW.balance_project_id, NEW.project_id);
      v_pm_user_id := NEW.user_id;
    ELSIF OLD.status = 'approved' AND NEW.status = 'approved'
          AND OLD.working_days_count IS DISTINCT FROM NEW.working_days_count THEN
      v_delta := NEW.working_days_count - OLD.working_days_count;
      v_leave_type := NEW.type;
      v_pm_project_id := COALESCE(NEW.balance_project_id, NEW.project_id);
      v_pm_user_id := NEW.user_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'approved' THEN
    v_delta := -OLD.working_days_count;
    v_user_id := OLD.user_id;
    v_leave_type := OLD.type;
    v_pm_project_id := COALESCE(OLD.balance_project_id, OLD.project_id);
    v_pm_user_id := OLD.user_id;
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

    IF v_pm_project_id IS NOT NULL AND v_pm_user_id IS NOT NULL THEN
      IF v_leave_type = 'annual' THEN
        UPDATE public.project_members
        SET annual_leave_used = GREATEST(0, annual_leave_used + v_delta)
        WHERE project_id = v_pm_project_id AND user_id = v_pm_user_id;
      ELSIF v_leave_type = 'sick' THEN
        UPDATE public.project_members
        SET sick_leave_used = GREATEST(0, sick_leave_used + v_delta)
        WHERE project_id = v_pm_project_id AND user_id = v_pm_user_id;
      ELSIF v_leave_type = 'religious' THEN
        UPDATE public.project_members
        SET religious_leave_used = GREATEST(0, religious_leave_used + v_delta)
        WHERE project_id = v_pm_project_id AND user_id = v_pm_user_id;
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
