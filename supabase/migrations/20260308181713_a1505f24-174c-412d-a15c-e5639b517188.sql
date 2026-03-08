
-- Create savings_goals table
CREATE TABLE public.savings_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  name text NOT NULL,
  goal_type text NOT NULL DEFAULT 'custom',
  target_amount numeric NOT NULL DEFAULT 0,
  current_amount numeric NOT NULL DEFAULT 0,
  target_date date,
  description text,
  priority integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own savings goals"
  ON public.savings_goals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own savings goals"
  ON public.savings_goals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own savings goals"
  ON public.savings_goals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own savings goals"
  ON public.savings_goals FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger: sync account balance to savings_goal current_amount
CREATE OR REPLACE FUNCTION public.sync_account_balance_to_savings_goal()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.current_balance IS DISTINCT FROM NEW.current_balance THEN
    UPDATE public.savings_goals
    SET current_amount = NEW.current_balance
    WHERE account_id = NEW.id AND is_active = true;
  END IF;
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    UPDATE public.savings_goals
    SET name = NEW.name
    WHERE account_id = NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_account_balance_change_sync_savings_goal
  AFTER UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_account_balance_to_savings_goal();

-- Trigger: updated_at
CREATE TRIGGER on_savings_goals_updated
  BEFORE UPDATE ON public.savings_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
