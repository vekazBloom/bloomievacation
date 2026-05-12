-- ============================================================================
-- BloomieVacation - Project slugs for readable URLs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.slugify_text(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' FROM regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g'));
$$;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS slug TEXT;

WITH numbered AS (
  SELECT
    id,
    CASE
      WHEN row_number() OVER (
        PARTITION BY public.slugify_text(name)
        ORDER BY created_at, id
      ) = 1 THEN public.slugify_text(name)
      ELSE public.slugify_text(name) || '-' || row_number() OVER (
        PARTITION BY public.slugify_text(name)
        ORDER BY created_at, id
      )::text
    END AS candidate
  FROM public.projects
)
UPDATE public.projects AS project
SET slug = numbered.candidate
FROM numbered
WHERE project.id = numbered.id
  AND project.slug IS NULL;

UPDATE public.projects
SET slug = 'project-' || substr(id::text, 1, 8)
WHERE slug IS NULL OR slug = '';

ALTER TABLE public.projects
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug ON public.projects(slug);

CREATE OR REPLACE FUNCTION public.set_project_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug TEXT;
  candidate_slug TEXT;
  suffix INT := 1;
BEGIN
  IF NEW.slug IS NOT NULL AND btrim(NEW.slug) <> '' THEN
    NEW.slug := public.slugify_text(NEW.slug);
  ELSE
  base_slug := public.slugify_text(NEW.name);
  IF base_slug = '' THEN
    base_slug := 'project';
  END IF;

  candidate_slug := base_slug;
  WHILE EXISTS (
    SELECT 1
    FROM public.projects
    WHERE slug = candidate_slug
      AND id IS DISTINCT FROM NEW.id
  ) LOOP
    suffix := suffix + 1;
    candidate_slug := base_slug || '-' || suffix;
  END LOOP;

  NEW.slug := candidate_slug;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_project_slug ON public.projects;
CREATE TRIGGER set_project_slug
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_slug();
