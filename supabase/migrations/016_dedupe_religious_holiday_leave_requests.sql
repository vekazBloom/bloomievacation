-- Remove duplicate auto-logged religious holidays: same user, same calendar day, same reason text,
-- and same status were inserted once per project membership (see syncReligiousLeaveRequests).
-- Keep the oldest row per group; DELETE triggers sync_leave_balance to correct global + per-project used.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, start_date, end_date, reason, status
      ORDER BY id
    ) AS rn
  FROM public.leave_requests
  WHERE type = 'religious'
    AND status = 'approved'
    AND start_date = end_date
    AND reason LIKE 'Religious holiday:%'
)
DELETE FROM public.leave_requests lr
USING ranked r
WHERE lr.id = r.id
  AND r.rn > 1;
