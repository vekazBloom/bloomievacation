ALTER TABLE public.jira_connections
ADD COLUMN IF NOT EXISTS default_board_id INT,
ADD COLUMN IF NOT EXISTS board_configs JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.jira_connections
SET default_board_id = COALESCE(default_board_id, board_id)
WHERE default_board_id IS NULL;
