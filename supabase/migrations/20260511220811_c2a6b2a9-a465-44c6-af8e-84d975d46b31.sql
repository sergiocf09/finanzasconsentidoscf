CREATE TABLE public.user_category_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, category_id)
);

ALTER TABLE public.user_category_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences"
  ON public.user_category_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_user_category_preferences_user ON public.user_category_preferences(user_id) WHERE is_hidden = true;