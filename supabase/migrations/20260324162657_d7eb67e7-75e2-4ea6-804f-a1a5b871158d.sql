CREATE TABLE public.non_financial_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  description TEXT,
  acquisition_value NUMERIC(15,2),
  current_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  acquisition_date DATE,
  currency TEXT NOT NULL DEFAULT 'MXN',
  linked_debt_id UUID REFERENCES public.debts(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.non_financial_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own non_financial_assets"
  ON public.non_financial_assets
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_nfa_user_id ON public.non_financial_assets(user_id);
CREATE INDEX idx_nfa_linked_debt ON public.non_financial_assets(linked_debt_id);