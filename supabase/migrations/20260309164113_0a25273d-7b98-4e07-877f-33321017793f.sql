
-- Create recurring_payments table
CREATE TABLE public.recurring_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'expense',
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  category_id uuid REFERENCES public.categories(id),
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'MXN',
  original_total_amount numeric,
  frequency text NOT NULL,
  start_date date NOT NULL,
  next_execution_date date NOT NULL,
  end_date date,
  total_payments integer,
  payments_made integer NOT NULL DEFAULT 0,
  remaining_balance numeric,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recurring_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own recurring payments" ON public.recurring_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own recurring payments" ON public.recurring_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recurring payments" ON public.recurring_payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recurring payments" ON public.recurring_payments FOR DELETE USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_recurring_payments_updated_at
  BEFORE UPDATE ON public.recurring_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add recurring_payment_id to transactions table to link generated transactions
ALTER TABLE public.transactions ADD COLUMN recurring_payment_id uuid REFERENCES public.recurring_payments(id) ON DELETE SET NULL;

-- Enable pg_cron and pg_net for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
