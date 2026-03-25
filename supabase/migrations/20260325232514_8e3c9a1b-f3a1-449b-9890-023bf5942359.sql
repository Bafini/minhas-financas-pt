
-- Singleton table to track the getUpdates offset
CREATE TABLE public.telegram_bot_state (
  id int PRIMARY KEY CHECK (id = 1),
  update_offset bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.telegram_bot_state (id, update_offset) VALUES (1, 0);

-- Table to link Telegram chat_id to user_id
CREATE TABLE public.telegram_user_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chat_id bigint UNIQUE,
  link_code text,
  link_code_expires timestamptz,
  mode text DEFAULT 'Despesas',
  active_card_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.telegram_user_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own telegram links"
  ON public.telegram_user_links FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own telegram links"
  ON public.telegram_user_links FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own telegram links"
  ON public.telegram_user_links FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own telegram links"
  ON public.telegram_user_links FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access bot state"
  ON public.telegram_bot_state FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.telegram_bot_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access telegram links"
  ON public.telegram_user_links FOR ALL TO service_role
  USING (true) WITH CHECK (true);
