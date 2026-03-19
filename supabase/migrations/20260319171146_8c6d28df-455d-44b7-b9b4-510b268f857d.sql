
-- Tabla para logs de conciliación
CREATE TABLE IF NOT EXISTS public.reconciliation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  debt_id UUID REFERENCES public.debts(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  reconciliation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  previous_balance NUMERIC(15,2) NOT NULL,
  real_balance NUMERIC(15,2) NOT NULL,
  difference NUMERIC(15,2) NOT NULL,
  unregistered_expenses NUMERIC(15,2) DEFAULT 0,
  financial_cost NUMERIC(15,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.reconciliation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own reconciliation logs"
  ON public.reconciliation_logs FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reconciliation_user_date
  ON public.reconciliation_logs (user_id, reconciliation_date);
