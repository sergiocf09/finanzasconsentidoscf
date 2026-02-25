
-- 1) Transfers table
CREATE TABLE public.transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  from_account_id UUID NOT NULL REFERENCES public.accounts(id),
  to_account_id UUID NOT NULL REFERENCES public.accounts(id),
  amount_from NUMERIC NOT NULL,
  currency_from TEXT NOT NULL DEFAULT 'MXN',
  amount_to NUMERIC NOT NULL,
  currency_to TEXT NOT NULL DEFAULT 'MXN',
  fx_rate NUMERIC,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  created_from TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transfers" ON public.transfers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own transfers" ON public.transfers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transfers" ON public.transfers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transfers" ON public.transfers FOR DELETE USING (auth.uid() = user_id);

-- Trigger: update balances on transfer insert/delete
CREATE OR REPLACE FUNCTION public.update_transfer_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.accounts SET current_balance = current_balance - NEW.amount_from WHERE id = NEW.from_account_id;
    UPDATE public.accounts SET current_balance = current_balance + NEW.amount_to WHERE id = NEW.to_account_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.accounts SET current_balance = current_balance + OLD.amount_from WHERE id = OLD.from_account_id;
    UPDATE public.accounts SET current_balance = current_balance - OLD.amount_to WHERE id = OLD.to_account_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER on_transfer_balance
AFTER INSERT OR DELETE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.update_transfer_balances();

-- 2) Budget lines table
CREATE TABLE public.budget_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id),
  planned_amount_monthly NUMERIC NOT NULL DEFAULT 0,
  planned_amount_annual NUMERIC GENERATED ALWAYS AS (planned_amount_monthly * 12) STORED,
  spent_amount NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own budget lines" ON public.budget_lines FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.budgets WHERE budgets.id = budget_lines.budget_id AND budgets.user_id = auth.uid()));
CREATE POLICY "Users can create own budget lines" ON public.budget_lines FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.budgets WHERE budgets.id = budget_lines.budget_id AND budgets.user_id = auth.uid()));
CREATE POLICY "Users can update own budget lines" ON public.budget_lines FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.budgets WHERE budgets.id = budget_lines.budget_id AND budgets.user_id = auth.uid()));
CREATE POLICY "Users can delete own budget lines" ON public.budget_lines FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.budgets WHERE budgets.id = budget_lines.budget_id AND budgets.user_id = auth.uid()));

-- 3) Budget rules table (50/30/20)
CREATE TABLE public.budget_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  rule_type TEXT NOT NULL DEFAULT 'ratio',
  essential_ratio NUMERIC NOT NULL DEFAULT 0.50,
  discretionary_ratio NUMERIC NOT NULL DEFAULT 0.30,
  saving_investing_ratio NUMERIC NOT NULL DEFAULT 0.20,
  currency TEXT NOT NULL DEFAULT 'MXN',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.budget_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own budget rules" ON public.budget_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own budget rules" ON public.budget_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budget rules" ON public.budget_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budget rules" ON public.budget_rules FOR DELETE USING (auth.uid() = user_id);

-- 4) Voice logs table
CREATE TABLE public.voice_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  transcript_raw TEXT,
  parsed_json JSONB,
  confidence NUMERIC,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.voice_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own voice logs" ON public.voice_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own voice logs" ON public.voice_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5) Add bucket column to categories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS bucket TEXT DEFAULT 'discretionary';

-- 6) Add created_from to budgets
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS created_from TEXT DEFAULT 'manual';
