-- Backfill leave_request_grant_allocations for annual requests that never got a row
-- (e.g. rejected/cancelled before 012, or created without split). Safe to re-run: only inserts when missing.

-- 1) Exactly one entitlement fund covers the request start date → attach full working days to that grant.
INSERT INTO public.leave_request_grant_allocations (leave_request_id, grant_id, working_days)
SELECT lr.id, g.id, lr.working_days_count
FROM public.leave_requests lr
INNER JOIN public.annual_entitlement_grants g
  ON g.project_id = lr.project_id
 AND g.user_id = lr.user_id
 AND lr.start_date >= g.valid_from
 AND (g.valid_to IS NULL OR lr.start_date <= g.valid_to)
WHERE lr.type = 'annual'
  AND lr.working_days_count > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.leave_request_grant_allocations a
    WHERE a.leave_request_id = lr.id
  )
  AND (
    SELECT COUNT(*)::int
    FROM public.annual_entitlement_grants g2
    WHERE g2.project_id = lr.project_id
      AND g2.user_id = lr.user_id
      AND lr.start_date >= g2.valid_from
      AND (g2.valid_to IS NULL OR lr.start_date <= g2.valid_to)
  ) = 1
ON CONFLICT (leave_request_id, grant_id) DO NOTHING;

-- 2) Remaining: attach to legacy pool (pre–multi-fund behaviour and multi-fund default).
INSERT INTO public.leave_request_grant_allocations (leave_request_id, grant_id, working_days)
SELECT lr.id, g.id, lr.working_days_count
FROM public.leave_requests lr
INNER JOIN public.annual_entitlement_grants g
  ON g.project_id = lr.project_id
 AND g.user_id = lr.user_id
 AND g.source = 'legacy_migration'
WHERE lr.type = 'annual'
  AND lr.working_days_count > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.leave_request_grant_allocations a
    WHERE a.leave_request_id = lr.id
  )
ON CONFLICT (leave_request_id, grant_id) DO NOTHING;

-- 3) Still missing (no legacy row): pick the grant with the latest valid_from for that member in the project.
INSERT INTO public.leave_request_grant_allocations (leave_request_id, grant_id, working_days)
SELECT DISTINCT ON (lr.id) lr.id, g.id, lr.working_days_count
FROM public.leave_requests lr
INNER JOIN public.annual_entitlement_grants g
  ON g.project_id = lr.project_id
 AND g.user_id = lr.user_id
WHERE lr.type = 'annual'
  AND lr.working_days_count > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.leave_request_grant_allocations a
    WHERE a.leave_request_id = lr.id
  )
ORDER BY lr.id, g.valid_from DESC
ON CONFLICT (leave_request_id, grant_id) DO NOTHING;
