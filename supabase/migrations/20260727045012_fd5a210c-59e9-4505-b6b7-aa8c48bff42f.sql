CREATE OR REPLACE FUNCTION public.cascade_delete_mirror_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Solo cuando el borrado lo origina el usuario (no en cascada desde el transfer)
  IF OLD.is_mirror AND OLD.source_transfer_id IS NOT NULL AND pg_trigger_depth() = 1 THEN
    DELETE FROM public.transfers WHERE id = OLD.source_transfer_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_delete_mirror_transaction ON public.transactions;
CREATE TRIGGER trg_cascade_delete_mirror_transaction
AFTER DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.cascade_delete_mirror_transaction();

CREATE OR REPLACE FUNCTION public.cascade_delete_goal_contribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.transfer_id IS NOT NULL AND pg_trigger_depth() = 1 THEN
    DELETE FROM public.transfers WHERE id = OLD.transfer_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_delete_goal_contribution ON public.goal_contributions;
CREATE TRIGGER trg_cascade_delete_goal_contribution
AFTER DELETE ON public.goal_contributions
FOR EACH ROW EXECUTE FUNCTION public.cascade_delete_goal_contribution();