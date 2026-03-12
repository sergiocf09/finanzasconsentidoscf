
DROP POLICY IF EXISTS "Service can insert push logs" ON public.push_logs;
CREATE POLICY "Users can insert own push logs"
  ON public.push_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
