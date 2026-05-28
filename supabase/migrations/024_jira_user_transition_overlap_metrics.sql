ALTER TABLE public.jira_sprint_user_metrics
ADD COLUMN IF NOT EXISTS qa_ready_done_only_count INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS qa_ready_both_transitions_count INT NOT NULL DEFAULT 0;
