-- Which project team sick/religious pool a request draws from (can differ from request project_id).

ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS balance_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

UPDATE public.leave_requests
SET balance_project_id = project_id
WHERE type IN ('sick', 'religious')
  AND balance_project_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_leave_requests_balance_project
  ON public.leave_requests(balance_project_id)
  WHERE balance_project_id IS NOT NULL;
