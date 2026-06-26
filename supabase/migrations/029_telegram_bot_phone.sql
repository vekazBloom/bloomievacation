-- Phone number for matching Telegram users to platform accounts.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone_number TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_number_unique
  ON public.users (phone_number)
  WHERE phone_number IS NOT NULL;

COMMENT ON COLUMN public.users.phone_number IS
  'E.164 normalized phone (e.g. +38761123456). Used to link Telegram contact to this account.';

-- One active Telegram link per user / per chat.
CREATE TABLE IF NOT EXISTS public.telegram_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  telegram_chat_id TEXT NOT NULL,
  telegram_user_id TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT telegram_connections_user_id_unique UNIQUE (user_id),
  CONSTRAINT telegram_connections_chat_id_unique UNIQUE (telegram_chat_id)
);

CREATE INDEX IF NOT EXISTS telegram_connections_user_id_idx
  ON public.telegram_connections (user_id)
  WHERE is_active = TRUE;

ALTER TABLE public.telegram_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "telegram_connections_select_self" ON public.telegram_connections
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "telegram_connections_update_self" ON public.telegram_connections
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Bot conversation state (service role only in app code).
CREATE TABLE IF NOT EXISTS public.bot_conversations (
  telegram_chat_id TEXT PRIMARY KEY,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  pending_request JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.bot_conversations ENABLE ROW LEVEL SECURITY;
