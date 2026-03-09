-- Create trigger to block direct UPDATE operations on transactions
-- This ensures ledger integrity by forcing DELETE + INSERT pattern (handled by atomic_update_transaction)
CREATE OR REPLACE FUNCTION public.block_transaction_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Direct updates to transactions are not allowed. Use atomic_update_transaction() function instead to maintain ledger integrity.';
  RETURN NULL;
END;
$$;

-- Create the trigger (BEFORE UPDATE to prevent the operation)
CREATE TRIGGER prevent_transaction_update
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.block_transaction_update();

-- Also protect transfers table with same pattern
CREATE OR REPLACE FUNCTION public.block_transfer_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Direct updates to transfers are not allowed. Delete and recreate the transfer to maintain ledger integrity.';
  RETURN NULL;
END;
$$;

CREATE TRIGGER prevent_transfer_update
  BEFORE UPDATE ON public.transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.block_transfer_update();