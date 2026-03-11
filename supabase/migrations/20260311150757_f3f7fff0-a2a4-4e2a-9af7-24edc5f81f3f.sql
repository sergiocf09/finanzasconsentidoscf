
-- Fix: Prevent users from inserting categories with is_system = true
DROP POLICY IF EXISTS "Users can create own categories" ON public.categories;
CREATE POLICY "Users can create own categories"
  ON public.categories FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id AND is_system = false);
