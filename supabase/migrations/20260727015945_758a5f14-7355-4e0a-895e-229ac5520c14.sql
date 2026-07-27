-- 1. Exclusividad de cuenta por meta activa
CREATE UNIQUE INDEX IF NOT EXISTS savings_goals_unique_active_account
  ON public.savings_goals (account_id)
  WHERE account_id IS NOT NULL AND is_active = TRUE;

-- 2. RPC seguro para vincular cuenta existente a una meta
CREATE OR REPLACE FUNCTION public.link_account_to_goal(p_goal_id uuid, p_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_balance numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT current_balance INTO v_balance
  FROM public.accounts
  WHERE id = p_account_id AND user_id = v_uid AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuenta no encontrada o sin acceso';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.savings_goals
    WHERE account_id = p_account_id AND is_active = TRUE AND id <> p_goal_id
  ) THEN
    RAISE EXCEPTION 'Esa cuenta ya está vinculada a otra meta activa';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.debts
    WHERE account_id = p_account_id AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Esa cuenta está vinculada a una deuda';
  END IF;

  UPDATE public.savings_goals
    SET account_id = p_account_id,
        current_amount = GREATEST(0, COALESCE(v_balance, 0)),
        updated_at = NOW()
  WHERE id = p_goal_id AND user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meta no encontrada o sin acceso';
  END IF;
END;
$$;

-- 3. Sincronización de nombre meta -> cuenta
CREATE OR REPLACE FUNCTION public.sync_savings_goal_to_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_id IS NOT NULL AND OLD.name IS DISTINCT FROM NEW.name THEN
    UPDATE public.accounts
      SET name = NEW.name
    WHERE id = NEW.account_id
      AND name IS DISTINCT FROM NEW.name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_goal_to_account ON public.savings_goals;
CREATE TRIGGER sync_goal_to_account
AFTER UPDATE ON public.savings_goals
FOR EACH ROW EXECUTE FUNCTION public.sync_savings_goal_to_account();

-- 4. Historial de aportaciones a metas
CREATE TABLE IF NOT EXISTS public.goal_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.savings_goals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  contribution_date date NOT NULL DEFAULT CURRENT_DATE,
  source text NOT NULL DEFAULT 'transfer',
  transfer_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.goal_contributions TO authenticated;
GRANT ALL ON public.goal_contributions TO service_role;

ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own goal contributions"
  ON public.goal_contributions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own goal contributions"
  ON public.goal_contributions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goal contributions"
  ON public.goal_contributions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS goal_contributions_goal_idx
  ON public.goal_contributions (goal_id, contribution_date DESC);

-- 5. Aportación + gasto espejo al transferir hacia la cuenta de una meta
CREATE OR REPLACE FUNCTION public.sync_goal_contribution_from_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_goal RECORD;
  v_cat_name text;
  v_cat_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT id, name, goal_type INTO v_goal
    FROM public.savings_goals
    WHERE account_id = NEW.to_account_id AND is_active = TRUE
    LIMIT 1;

    IF v_goal.id IS NULL THEN
      RETURN NEW;
    END IF;

    v_cat_name := CASE v_goal.goal_type
      WHEN 'emergency' THEN 'Fondo de emergencia'
      WHEN 'retirement' THEN 'Retiro'
      WHEN 'business' THEN 'Inversiones'
      WHEN 'custom' THEN 'Ahorro'
      ELSE 'Metas específicas'
    END;

    SELECT id INTO v_cat_id
    FROM public.categories
    WHERE is_system = TRUE AND name = v_cat_name
    LIMIT 1;

    IF v_cat_id IS NULL THEN
      SELECT id INTO v_cat_id
      FROM public.categories
      WHERE is_system = TRUE AND name = 'Ahorro'
      LIMIT 1;
    END IF;

    INSERT INTO public.goal_contributions (
      goal_id, user_id, amount, contribution_date, source, transfer_id, notes
    ) VALUES (
      v_goal.id, NEW.user_id, NEW.amount_to, NEW.transfer_date,
      'transfer', NEW.id, COALESCE(NEW.description, 'Aportación desde transferencia')
    );

    INSERT INTO public.transactions (
      user_id, account_id, type, amount, transaction_date,
      category_id, description, currency, exchange_rate, amount_in_base,
      is_mirror, source_transfer_id
    ) VALUES (
      NEW.user_id,
      NEW.from_account_id,
      'expense',
      NEW.amount_from,
      NEW.transfer_date,
      v_cat_id,
      'Aportación a meta: ' || v_goal.name,
      NEW.currency_from,
      COALESCE(NEW.fx_rate, 1),
      CASE WHEN NEW.currency_from = 'MXN'
           THEN NEW.amount_from
           ELSE NEW.amount_from * COALESCE(NEW.fx_rate, 1)
      END,
      TRUE,
      NEW.id
    );

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.transactions
    WHERE source_transfer_id = OLD.id AND is_mirror = TRUE;

    DELETE FROM public.goal_contributions
    WHERE transfer_id = OLD.id;

    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_zzsync_goal_contribution ON public.transfers;
CREATE TRIGGER trg_zzsync_goal_contribution
AFTER INSERT OR DELETE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.sync_goal_contribution_from_transfer();