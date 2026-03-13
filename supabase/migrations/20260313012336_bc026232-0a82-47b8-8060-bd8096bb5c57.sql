DROP POLICY IF EXISTS "Users can create own transfers" ON public.transfers;
CREATE POLICY "Users can create own transfers"
  ON public.transfers FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.accounts WHERE id = transfers.from_account_id AND accounts.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.accounts WHERE id = transfers.to_account_id AND accounts.user_id = auth.uid())
  );