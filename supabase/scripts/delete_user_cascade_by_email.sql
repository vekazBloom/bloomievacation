-- =============================================================================
-- Kaskadno brisanje korisnika adela.pervan@bloomteq.com i svega vezanog uz njega.
-- Supabase → SQL Editor (service role / postgres).
--
-- 1) Prvo pokreni: supabase/scripts/check_user_by_email.sql
-- 2) Pregledaj rezultate, zatim pokreni DELETE blokove ispod (jedan po jedan ili cijelu skriptu).
--
-- public.users.id → ON DELETE CASCADE na većinu tablica.
-- Brisanje auth.users briše i public.users (FK auth.users → CASCADE).
-- invitations nema user_id — brišu se po emailu.
-- decided_by / performed_by / sent_by → SET NULL (ostaju zahtjevi, gubi se tko je odobrio).
-- =============================================================================

BEGIN;

-- Pregled prije brisanja
SELECT
  au.id AS auth_id,
  u.id AS public_id,
  u.email,
  u.name
FROM auth.users au
FULL OUTER JOIN public.users u ON u.id = au.id
WHERE lower(trim(coalesce(au.email, u.email))) = lower(trim('adela.pervan@bloomteq.com'));

-- Pending inviteovi na taj email (nema FK na users)
DELETE FROM public.invitations
WHERE lower(trim(email)) = lower(trim('adela.pervan@bloomteq.com'));

-- Glavno brisanje: auth korisnik → CASCADE na public.users i povezane tablice
DELETE FROM auth.users
WHERE lower(trim(email)) = lower(trim('adela.pervan@bloomteq.com'));

-- Ako auth red ne postoji, ali public.users još postoji (rjetko):
DELETE FROM public.users
WHERE lower(trim(email)) = lower(trim('adela.pervan@bloomteq.com'))
  AND NOT EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = public.users.id
  );

-- Provjera nakon brisanja
SELECT
  EXISTS (
    SELECT 1 FROM auth.users au
    WHERE lower(trim(au.email)) = lower(trim('adela.pervan@bloomteq.com'))
  ) AS auth_still_exists,
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE lower(trim(u.email)) = lower(trim('adela.pervan@bloomteq.com'))
  ) AS public_still_exists,
  (
    SELECT COUNT(*) FROM public.invitations i
    WHERE lower(trim(i.email)) = lower(trim('adela.pervan@bloomteq.com'))
  ) AS invitations_remaining;

-- Kad si siguran, pokreni:
-- COMMIT;
--
-- Za probni run bez trajnog brisanja:
-- ROLLBACK;
