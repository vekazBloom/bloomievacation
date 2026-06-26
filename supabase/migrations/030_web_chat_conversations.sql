-- Web in-app chat conversation state (separate from Telegram bot_conversations).
CREATE TABLE IF NOT EXISTS public.web_chat_conversations (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  pending_request JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.web_chat_conversations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.web_chat_conversations IS
  'In-app chat widget state. Accessed via service role in API routes.';
