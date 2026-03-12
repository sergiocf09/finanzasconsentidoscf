
DO $$
DECLARE
  v_old_cat_id uuid;
  v_new_cat_id uuid;
BEGIN
  -- Get IDs
  SELECT id INTO v_old_cat_id FROM public.categories WHERE is_system = true AND name = 'Restaurantes y cafés' AND type = 'expense' LIMIT 1;
  SELECT id INTO v_new_cat_id FROM public.categories WHERE is_system = true AND name = 'Restaurantes' AND type = 'expense' LIMIT 1;

  -- If old category doesn't exist, nothing to do
  IF v_old_cat_id IS NULL THEN
    RETURN;
  END IF;

  -- Reassign transactions
  UPDATE public.transactions SET category_id = v_new_cat_id WHERE category_id = v_old_cat_id;

  -- For budgets: merge spent into existing budget if duplicate would occur, then delete old
  UPDATE public.budgets b_new
  SET spent = COALESCE(b_new.spent, 0) + COALESCE(b_old.spent, 0),
      amount = GREATEST(b_new.amount, b_old.amount)
  FROM public.budgets b_old
  WHERE b_old.category_id = v_old_cat_id
    AND b_new.category_id = v_new_cat_id
    AND b_new.user_id = b_old.user_id
    AND b_new.period = b_old.period
    AND COALESCE(b_new.month, 0) = COALESCE(b_old.month, 0)
    AND b_new.year = b_old.year;

  -- Delete old budgets that were merged
  DELETE FROM public.budgets b_old
  WHERE b_old.category_id = v_old_cat_id
    AND EXISTS (
      SELECT 1 FROM public.budgets b_new
      WHERE b_new.category_id = v_new_cat_id
        AND b_new.user_id = b_old.user_id
        AND b_new.period = b_old.period
        AND COALESCE(b_new.month, 0) = COALESCE(b_old.month, 0)
        AND b_new.year = b_old.year
    );

  -- Reassign remaining budgets (no conflict)
  UPDATE public.budgets SET category_id = v_new_cat_id WHERE category_id = v_old_cat_id;

  -- Reassign budget_lines
  UPDATE public.budget_lines SET category_id = v_new_cat_id WHERE category_id = v_old_cat_id;

  -- Reassign recurring_payments
  UPDATE public.recurring_payments SET category_id = v_new_cat_id WHERE category_id = v_old_cat_id;

  -- Reassign voice_rules
  UPDATE public.voice_rules SET category_id = v_new_cat_id WHERE category_id = v_old_cat_id;

  -- Delete old category
  DELETE FROM public.categories WHERE id = v_old_cat_id;

  -- Update keywords on Restaurantes
  UPDATE public.categories
  SET keywords = ARRAY['restaurante','cafe','starbucks','tacos','sushi','pizza','comida rapida','oxxo','antojitos','cafeteria','comida','cena','desayuno']::TEXT[]
  WHERE id = v_new_cat_id;
END;
$$;
