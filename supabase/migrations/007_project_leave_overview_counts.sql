-- ============================================================================
-- BloomieVacation - Project overview leave aggregates
-- ============================================================================

CREATE OR REPLACE FUNCTION public.project_leave_overview_counts(
  p_project_id uuid,
  p_today date,
  p_week_end date,
  p_month_start date
)
RETURNS TABLE (
  pending_count bigint,
  approved_count bigint,
  rejected_count bigint,
  cancelled_count bigint,
  annual_count bigint,
  sick_count bigint,
  religious_count bigint,
  approved_this_month bigint,
  away_this_week bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
    COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
    COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
    COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_count,
    COUNT(*) FILTER (WHERE type = 'annual') AS annual_count,
    COUNT(*) FILTER (WHERE type = 'sick') AS sick_count,
    COUNT(*) FILTER (WHERE type = 'religious') AS religious_count,
    COUNT(*) FILTER (
      WHERE status = 'approved'
        AND created_at >= p_month_start::timestamptz
    ) AS approved_this_month,
    COUNT(DISTINCT user_id) FILTER (
      WHERE status = 'approved'
        AND start_date <= p_week_end
        AND end_date >= p_today
    ) AS away_this_week
  FROM public.leave_requests
  WHERE project_id = p_project_id;
$$;

GRANT EXECUTE ON FUNCTION public.project_leave_overview_counts(uuid, date, date, date) TO authenticated;
