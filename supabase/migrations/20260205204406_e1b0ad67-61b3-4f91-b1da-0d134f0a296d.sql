-- =====================================================
-- FINANZAS CON SENTIDO™ - COMPLETE DATABASE SCHEMA
-- =====================================================

-- 1. PROFILES TABLE (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  base_currency TEXT DEFAULT 'MXN',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. CURRENCIES TABLE (reference data)
CREATE TABLE public.currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  decimal_places INTEGER DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default currencies
INSERT INTO public.currencies (code, name, symbol) VALUES
  ('MXN', 'Peso Mexicano', '$'),
  ('USD', 'Dólar Estadounidense', '$'),
  ('EUR', 'Euro', '€'),
  ('GBP', 'Libra Esterlina', '£'),
  ('CAD', 'Dólar Canadiense', '$'),
  ('JPY', 'Yen Japonés', '¥');

-- 3. ACCOUNTS TABLE
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'savings', 'investment', 'credit_card', 'payable')),
  currency TEXT NOT NULL DEFAULT 'MXN',
  initial_balance NUMERIC(15,2) DEFAULT 0,
  current_balance NUMERIC(15,2) DEFAULT 0,
  color TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. CATEGORIES TABLE
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  icon TEXT,
  color TEXT,
  is_system BOOLEAN DEFAULT false,
  parent_id UUID REFERENCES public.categories(id),
  keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert system default categories (user_id NULL = system categories)
INSERT INTO public.categories (user_id, name, type, icon, is_system, keywords) VALUES
  (NULL, 'Alimentación', 'expense', 'utensils', true, ARRAY['oxxo', 'soriana', 'walmart', 'heb', 'costco', 'supermercado', 'comida', 'restaurante', 'cafe', 'starbucks']::TEXT[]),
  (NULL, 'Transporte', 'expense', 'car', true, ARRAY['uber', 'didi', 'gasolina', 'gas', 'estacionamiento', 'taxi', 'metro', 'autobus']::TEXT[]),
  (NULL, 'Vivienda', 'expense', 'home', true, ARRAY['renta', 'hipoteca', 'mantenimiento', 'agua', 'luz', 'internet', 'telefono']::TEXT[]),
  (NULL, 'Entretenimiento', 'expense', 'gamepad-2', true, ARRAY['netflix', 'spotify', 'cine', 'teatro', 'concierto', 'fiesta', 'bar', 'antro']::TEXT[]),
  (NULL, 'Salud', 'expense', 'heart-pulse', true, ARRAY['doctor', 'hospital', 'farmacia', 'medicina', 'gym', 'gimnasio']::TEXT[]),
  (NULL, 'Educación', 'expense', 'graduation-cap', true, ARRAY['colegiatura', 'curso', 'libro', 'escuela', 'universidad']::TEXT[]),
  (NULL, 'Ropa', 'expense', 'shirt', true, ARRAY['ropa', 'zapatos', 'zara', 'liverpool', 'palacio']::TEXT[]),
  (NULL, 'Servicios', 'expense', 'settings', true, ARRAY['servicio', 'suscripcion', 'membresia']::TEXT[]),
  (NULL, 'Otros gastos', 'expense', 'more-horizontal', true, ARRAY[]::TEXT[]),
  (NULL, 'Salario', 'income', 'banknote', true, ARRAY['salario', 'sueldo', 'nomina', 'quincena']::TEXT[]),
  (NULL, 'Freelance', 'income', 'laptop', true, ARRAY['freelance', 'proyecto', 'cliente']::TEXT[]),
  (NULL, 'Inversiones', 'income', 'trending-up', true, ARRAY['dividendo', 'interes', 'rendimiento']::TEXT[]),
  (NULL, 'Pensión', 'income', 'calendar', true, ARRAY['pension', 'jubilacion']::TEXT[]),
  (NULL, 'Otros ingresos', 'income', 'plus', true, ARRAY[]::TEXT[]),
  (NULL, 'Transferencia', 'transfer', 'arrow-left-right', true, ARRAY['transferencia', 'traspaso']::TEXT[]);

-- 5. TRANSACTIONS TABLE
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MXN',
  exchange_rate NUMERIC(15,6) DEFAULT 1,
  amount_in_base NUMERIC(15,2),
  description TEXT,
  notes TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_recurring BOOLEAN DEFAULT false,
  recurring_frequency TEXT CHECK (recurring_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'yearly')),
  related_account_id UUID REFERENCES public.accounts(id),
  voice_transcript TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. BUDGETS TABLE
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id),
  name TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('monthly', 'yearly')),
  month INTEGER CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  spent NUMERIC(15,2) DEFAULT 0,
  alert_threshold NUMERIC(3,2) DEFAULT 0.80,
  alert_sent BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. DEBTS TABLE
CREATE TABLE public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit_card', 'personal_loan', 'mortgage', 'car_loan', 'student_loan', 'other')),
  creditor TEXT,
  original_amount NUMERIC(15,2) NOT NULL,
  current_balance NUMERIC(15,2) NOT NULL,
  interest_rate NUMERIC(5,2) DEFAULT 0,
  minimum_payment NUMERIC(15,2) DEFAULT 0,
  due_day INTEGER CHECK (due_day >= 1 AND due_day <= 31),
  start_date DATE,
  currency TEXT NOT NULL DEFAULT 'MXN',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. DEBT PAYMENTS TABLE
CREATE TABLE public.debt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(15,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. EMERGENCY FUND TABLE
CREATE TABLE public.emergency_fund (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_amount NUMERIC(15,2) NOT NULL,
  current_amount NUMERIC(15,2) DEFAULT 0,
  monthly_target NUMERIC(15,2),
  target_date DATE,
  currency TEXT NOT NULL DEFAULT 'MXN',
  months_of_expenses INTEGER DEFAULT 6,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 10. EMERGENCY FUND CONTRIBUTIONS TABLE
CREATE TABLE public.emergency_fund_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES public.emergency_fund(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(15,2) NOT NULL,
  contribution_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. EBOOKS TABLE
CREATE TABLE public.ebooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT,
  description TEXT,
  cover_url TEXT,
  file_url TEXT,
  collection TEXT,
  is_downloaded BOOLEAN DEFAULT false,
  progress NUMERIC(3,2) DEFAULT 0,
  last_read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. VOICE CLASSIFICATION RULES (for learning)
CREATE TABLE public.voice_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. EXCHANGE RATES TABLE
CREATE TABLE public.exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate NUMERIC(15,6) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(from_currency, to_currency, date)
);

-- Insert some default exchange rates
INSERT INTO public.exchange_rates (from_currency, to_currency, rate) VALUES
  ('USD', 'MXN', 17.50),
  ('EUR', 'MXN', 19.00),
  ('MXN', 'USD', 0.057),
  ('MXN', 'EUR', 0.053);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_fund ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_fund_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- PROFILES
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- CURRENCIES (public read)
CREATE POLICY "Anyone can view currencies" ON public.currencies FOR SELECT USING (true);

-- ACCOUNTS
CREATE POLICY "Users can view own accounts" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own accounts" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON public.accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON public.accounts FOR DELETE USING (auth.uid() = user_id);

-- CATEGORIES (system + own)
CREATE POLICY "Users can view system and own categories" ON public.categories FOR SELECT 
  USING (is_system = true OR auth.uid() = user_id);
CREATE POLICY "Users can create own categories" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.categories FOR UPDATE USING (auth.uid() = user_id AND is_system = false);
CREATE POLICY "Users can delete own categories" ON public.categories FOR DELETE USING (auth.uid() = user_id AND is_system = false);

-- TRANSACTIONS
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON public.transactions FOR DELETE USING (auth.uid() = user_id);

-- BUDGETS
CREATE POLICY "Users can view own budgets" ON public.budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own budgets" ON public.budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budgets" ON public.budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budgets" ON public.budgets FOR DELETE USING (auth.uid() = user_id);

-- DEBTS
CREATE POLICY "Users can view own debts" ON public.debts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own debts" ON public.debts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own debts" ON public.debts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own debts" ON public.debts FOR DELETE USING (auth.uid() = user_id);

-- DEBT PAYMENTS
CREATE POLICY "Users can view own debt payments" ON public.debt_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own debt payments" ON public.debt_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own debt payments" ON public.debt_payments FOR DELETE USING (auth.uid() = user_id);

-- EMERGENCY FUND
CREATE POLICY "Users can view own emergency fund" ON public.emergency_fund FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own emergency fund" ON public.emergency_fund FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own emergency fund" ON public.emergency_fund FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own emergency fund" ON public.emergency_fund FOR DELETE USING (auth.uid() = user_id);

-- EMERGENCY FUND CONTRIBUTIONS
CREATE POLICY "Users can view own contributions" ON public.emergency_fund_contributions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own contributions" ON public.emergency_fund_contributions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own contributions" ON public.emergency_fund_contributions FOR DELETE USING (auth.uid() = user_id);

-- EBOOKS
CREATE POLICY "Users can view own ebooks" ON public.ebooks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own ebooks" ON public.ebooks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ebooks" ON public.ebooks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ebooks" ON public.ebooks FOR DELETE USING (auth.uid() = user_id);

-- VOICE RULES
CREATE POLICY "Users can view own voice rules" ON public.voice_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own voice rules" ON public.voice_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own voice rules" ON public.voice_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own voice rules" ON public.voice_rules FOR DELETE USING (auth.uid() = user_id);

-- EXCHANGE RATES (public read)
CREATE POLICY "Anyone can view exchange rates" ON public.exchange_rates FOR SELECT USING (true);

-- =====================================================
-- TRIGGERS & FUNCTIONS
-- =====================================================

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_debts_updated_at BEFORE UPDATE ON public.debts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_emergency_fund_updated_at BEFORE UPDATE ON public.emergency_fund FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update account balance on transaction
CREATE OR REPLACE FUNCTION public.update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'income' THEN
      UPDATE public.accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'expense' THEN
      UPDATE public.accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'transfer' THEN
      UPDATE public.accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
      IF NEW.related_account_id IS NOT NULL THEN
        UPDATE public.accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.related_account_id;
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.type = 'income' THEN
      UPDATE public.accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'expense' THEN
      UPDATE public.accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'transfer' THEN
      UPDATE public.accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
      IF OLD.related_account_id IS NOT NULL THEN
        UPDATE public.accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.related_account_id;
      END IF;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_balance_on_transaction
  AFTER INSERT OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_account_balance();

-- Function to update budget spent amount
CREATE OR REPLACE FUNCTION public.update_budget_spent()
RETURNS TRIGGER AS $$
DECLARE
  tx_month INTEGER;
  tx_year INTEGER;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.type = 'expense' AND NEW.category_id IS NOT NULL THEN
    tx_month := EXTRACT(MONTH FROM NEW.transaction_date);
    tx_year := EXTRACT(YEAR FROM NEW.transaction_date);
    
    UPDATE public.budgets 
    SET spent = spent + NEW.amount
    WHERE user_id = NEW.user_id 
      AND category_id = NEW.category_id 
      AND ((period = 'monthly' AND month = tx_month AND year = tx_year) OR (period = 'yearly' AND year = tx_year));
  ELSIF TG_OP = 'DELETE' AND OLD.type = 'expense' AND OLD.category_id IS NOT NULL THEN
    tx_month := EXTRACT(MONTH FROM OLD.transaction_date);
    tx_year := EXTRACT(YEAR FROM OLD.transaction_date);
    
    UPDATE public.budgets 
    SET spent = spent - OLD.amount
    WHERE user_id = OLD.user_id 
      AND category_id = OLD.category_id 
      AND ((period = 'monthly' AND month = tx_month AND year = tx_year) OR (period = 'yearly' AND year = tx_year));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_budget_on_transaction
  AFTER INSERT OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_budget_spent();

-- Function to update emergency fund on contribution
CREATE OR REPLACE FUNCTION public.update_emergency_fund_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.emergency_fund SET current_amount = current_amount + NEW.amount WHERE id = NEW.fund_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.emergency_fund SET current_amount = current_amount - OLD.amount WHERE id = OLD.fund_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_fund_on_contribution
  AFTER INSERT OR DELETE ON public.emergency_fund_contributions
  FOR EACH ROW EXECUTE FUNCTION public.update_emergency_fund_balance();

-- Function to update debt balance on payment
CREATE OR REPLACE FUNCTION public.update_debt_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.debts SET current_balance = current_balance - NEW.amount WHERE id = NEW.debt_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.debts SET current_balance = current_balance + OLD.amount WHERE id = OLD.debt_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_debt_on_payment
  AFTER INSERT OR DELETE ON public.debt_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_debt_balance();

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_date ON public.transactions(transaction_date);
CREATE INDEX idx_transactions_category ON public.transactions(category_id);
CREATE INDEX idx_transactions_account ON public.transactions(account_id);
CREATE INDEX idx_budgets_user_id ON public.budgets(user_id);
CREATE INDEX idx_budgets_period ON public.budgets(year, month);
CREATE INDEX idx_debts_user_id ON public.debts(user_id);
CREATE INDEX idx_categories_user_id ON public.categories(user_id);
CREATE INDEX idx_voice_rules_user_keyword ON public.voice_rules(user_id, keyword);