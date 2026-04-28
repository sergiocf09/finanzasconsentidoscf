-- Estandarizar nombre de trigger on_transfer_balance al prefijo trg_
-- El trigger fue creado en Feb 2026 antes de adoptar el prefijo trg_
DROP TRIGGER IF EXISTS on_transfer_balance ON public.transfers;

CREATE TRIGGER trg_transfer_balance
  AFTER INSERT OR DELETE ON public.transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_transfer_balances();