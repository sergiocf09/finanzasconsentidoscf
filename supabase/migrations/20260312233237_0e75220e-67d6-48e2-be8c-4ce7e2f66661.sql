
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_subscription JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.push_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN DEFAULT TRUE
);

ALTER TABLE public.push_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own push logs"
  ON public.push_logs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can insert push logs"
  ON public.push_logs FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_push_logs_user_type_date
  ON public.push_logs (user_id, type, sent_at);

CREATE OR REPLACE FUNCTION public.update_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles SET last_active_at = NOW() WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_update_last_active ON public.transactions;
CREATE TRIGGER trg_update_last_active
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_last_active();
