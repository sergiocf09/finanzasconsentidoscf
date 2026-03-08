-- Fix Arq App account balance: should be $10,000 (initial 0 + one $10,000 income)
UPDATE public.accounts 
SET current_balance = 10000 
WHERE id = 'e4c4f030-6851-4db7-9c3c-5ae47c92ae1d' 
AND current_balance = 20000;