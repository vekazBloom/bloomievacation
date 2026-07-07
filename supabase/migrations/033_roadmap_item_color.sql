-- Optional per-item chip color override. When NULL the chip uses its status color;
-- when set (a #RRGGBB hex) the timeline renders the box in that color instead.

ALTER TABLE public.roadmap_items ADD COLUMN IF NOT EXISTS color TEXT;
