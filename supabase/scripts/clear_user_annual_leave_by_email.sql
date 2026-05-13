-- =============================================================================
-- Ukloni sve GODIŠNJE (annual) leave_requests za korisnika — nestaju s kalendara.
-- Supabase → SQL Editor (postgres / role koji zaobilazi RLS).
--
-- Kalendari u aplikaciji čitaju public.leave_requests (pending + approved).
-- Povijest: leave_request_history za te ID-eve briše se CASCADE.
-- Za odobrene zahtjeve, trigger sync_leave_balance smanjuje annual_leave_used
-- u user_leave_balances (ako postoji migracija 008).
-- =============================================================================

-- 1) PREGLED — pokreni prvo i provjeri redove
SELECT
  lr.id,
  lr.project_id,
  p.name AS project,
  lr.status,
  lr.start_date,
  lr.end_date,
  lr.working_days_count,
  lr.reason
FROM public.leave_requests lr
JOIN public.users u ON u.id = lr.user_id
LEFT JOIN public.projects p ON p.id = lr.project_id
WHERE lower(trim(u.email)) = lower(trim('edis.banjic@bloomteq.com'))
  AND lr.type = 'annual'
ORDER BY lr.start_date;

-- 2) BRISANJE — pokreni nakon pregleda (možeš označiti samo ovaj DELETE ako želiš)
DELETE FROM public.leave_requests lr
USING public.users u
WHERE u.id = lr.user_id
  AND lower(trim(u.email)) = lower(trim('edis.banjic@bloomteq.com'))
  AND lr.type = 'annual';

-- Samo jedan projekt (opcionalno zamijeni UUID):
-- DELETE FROM public.leave_requests lr
-- USING public.users u
-- WHERE u.id = lr.user_id
--   AND lower(trim(u.email)) = lower(trim('edis.banjic@bloomteq.com'))
--   AND lr.type = 'annual'
--   AND lr.project_id = '00000000-0000-0000-0000-000000000000';
