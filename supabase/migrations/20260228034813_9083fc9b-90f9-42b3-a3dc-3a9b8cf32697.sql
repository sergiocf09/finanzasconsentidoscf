
-- Create reconciliation table for balance adjustments (informational only)
CREATE TABLE public.account_reconciliations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  previous_balance NUMERIC NOT NULL,
  new_balance NUMERIC NOT NULL,
  delta NUMERIC NOT NULL,
  note TEXT,
  reconciled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.account_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reconciliations" ON public.account_reconciliations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own reconciliations" ON public.account_reconciliations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reconciliations" ON public.account_reconciliations
  FOR DELETE USING (auth.uid() = user_id);
