-- Structured within-team dependency link. A feature can depend on another feature;
-- the timeline draws a connector line from the prerequisite to the dependent.
-- Nullable; ON DELETE SET NULL so removing a prerequisite just drops the link.

ALTER TABLE public.roadmap_items
  ADD COLUMN IF NOT EXISTS depends_on_id UUID REFERENCES public.roadmap_items(id) ON DELETE SET NULL;
