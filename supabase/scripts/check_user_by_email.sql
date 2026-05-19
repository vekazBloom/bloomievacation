-- =============================================================================
-- Provjera postoji li korisnik (auth + public + povezani podaci).
-- Supabase → SQL Editor (service role / postgres).
--
-- Email za provjeru:
--   adela.pervan@bloomteq.com
-- =============================================================================

-- Auth (Supabase Authentication)
SELECT
  'auth.users' AS source,
  au.id,
  au.email,
  au.email_confirmed_at,
  au.created_at,
  au.last_sign_in_at
FROM auth.users au
WHERE lower(trim(au.email)) = lower(trim('adela.pervan@bloomteq.com'));

-- Public profile
SELECT
  'public.users' AS source,
  u.id,
  u.email,
  u.name,
  u.is_system_admin,
  u.created_at
FROM public.users u
WHERE lower(trim(u.email)) = lower(trim('adela.pervan@bloomteq.com'));

-- Sažetak: postoji li barem jedan red
SELECT
  'adela.pervan@bloomteq.com' AS email,
  EXISTS (
    SELECT 1 FROM auth.users au
    WHERE lower(trim(au.email)) = lower(trim('adela.pervan@bloomteq.com'))
  ) AS auth_user_exists,
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE lower(trim(u.email)) = lower(trim('adela.pervan@bloomteq.com'))
  ) AS public_user_exists;

-- Broj zapisa po tablicama (samo ako public.users postoji)
WITH u AS (
  SELECT id FROM public.users
  WHERE lower(trim(email)) = lower(trim('adela.pervan@bloomteq.com'))
)
SELECT 'project_members' AS table_name, COUNT(*)::bigint AS row_count
FROM public.project_members pm, u WHERE pm.user_id = u.id
UNION ALL
SELECT 'leave_requests', COUNT(*) FROM public.leave_requests lr, u WHERE lr.user_id = u.id
UNION ALL
SELECT 'leave_requests (decided_by)', COUNT(*) FROM public.leave_requests lr, u WHERE lr.decided_by = u.id
UNION ALL
SELECT 'user_religious_selections', COUNT(*) FROM public.user_religious_selections urs, u WHERE urs.user_id = u.id
UNION ALL
SELECT 'notifications', COUNT(*) FROM public.notifications n, u WHERE n.user_id = u.id
UNION ALL
SELECT 'carry_over_decisions', COUNT(*) FROM public.carry_over_decisions cod, u WHERE cod.user_id = u.id
UNION ALL
SELECT 'user_leave_balances', COUNT(*) FROM public.user_leave_balances ulb, u WHERE ulb.user_id = u.id
UNION ALL
SELECT 'annual_entitlement_grants', COUNT(*) FROM public.annual_entitlement_grants g, u WHERE g.user_id = u.id
UNION ALL
SELECT 'user_annual_fund_definition_assignments', COUNT(*)
FROM public.user_annual_fund_definition_assignments a, u WHERE a.user_id = u.id
UNION ALL
SELECT 'user_leave_approval_forward_emails', COUNT(*)
FROM public.user_leave_approval_forward_emails f, u WHERE f.user_id = u.id
UNION ALL
SELECT 'invitations (by email)', COUNT(*)
FROM public.invitations i
WHERE lower(trim(i.email)) = lower(trim('adela.pervan@bloomteq.com'))
ORDER BY table_name;
