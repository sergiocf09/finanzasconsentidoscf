
-- 1. Update existing bucket values to new nomenclature
UPDATE public.categories SET bucket = 'stability' WHERE bucket = 'essential';
UPDATE public.categories SET bucket = 'lifestyle' WHERE bucket = 'discretionary';
UPDATE public.categories SET bucket = 'build' WHERE bucket = 'saving_investing';

-- 2. Create diagnostics table for persistence
CREATE TABLE public.diagnostics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  analysis_months INTEGER NOT NULL DEFAULT 3,
  stability_pct NUMERIC NOT NULL DEFAULT 0,
  lifestyle_pct NUMERIC NOT NULL DEFAULT 0,
  build_pct NUMERIC NOT NULL DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'stabilize',
  total_expenses NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.diagnostics ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
CREATE POLICY "Users can view own diagnostics" ON public.diagnostics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own diagnostics" ON public.diagnostics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own diagnostics" ON public.diagnostics
  FOR DELETE USING (auth.uid() = user_id);
