-- ============================================================================
-- BloomieVacation - Admin dashboard project counts
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_project_dashboard_counts(
  p_today date,
  p_week_end date
)
RETURNS TABLE (
  project_id uuid,
  member_count bigint,
  pending_count bigint,
  away_this_week_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS project_id,
    COUNT(DISTINCT pm.user_id) AS member_count,
    COUNT(DISTINCT lr_pending.id) AS pending_count,
    COUNT(DISTINCT lr_away.user_id) AS away_this_week_count
  FROM public.projects p
  LEFT JOIN public.project_members pm ON pm.project_id = p.id
  LEFT JOIN public.leave_requests lr_pending
    ON lr_pending.project_id = p.id
    AND lr_pending.status = 'pending'
  LEFT JOIN public.leave_requests lr_away
    ON lr_away.project_id = p.id
    AND lr_away.status = 'approved'
    AND lr_away.start_date <= p_week_end
    AND lr_away.end_date >= p_today
  WHERE p.is_archived = FALSE
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.is_system_admin = TRUE
    )
  GROUP BY p.id;
$$;

GRANT EXECUTE ON FUNCTION public.admin_project_dashboard_counts(date, date) TO authenticated;
