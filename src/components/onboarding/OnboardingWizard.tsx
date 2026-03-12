import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AccountType } from "@/hooks/useAccounts";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent,
} from "@/components/ui/dialog";
import { Sparkles, Wallet, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useAccounts } from "@/hooks/useAccounts";
import { useTransactions } from "@/hooks/useTransactions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface OnboardingWizardProps {
  open: boolean;
  onDismiss: () => void;
  displayName: string;
  baseCurrency: string;
}

export function OnboardingWizard({ open, onDismiss, displayName, baseCurrency }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [currency, setCurrency] = useState(baseCurrency || "MXN");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("bank");
  const [accountBalance, setAccountBalance] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeDesc, setIncomeDesc] = useState("");
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [saving, setSaving] = useState(false);

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { createAccount, accounts } = useAccounts();
  const { createTransaction } = useTransactions();

  const saveCurrency = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ base_currency: currency }).eq("id", user.id);
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  const saveAccount = async () => {
    if (!accountName.trim()) return;
    setSaving(true);
    try {
      await createAccount.mutateAsync({
        name: accountName.trim(),
        type: accountType,
        currency,
        initial_balance: Number(accountBalance) || 0,
      });
    } finally {
      setSaving(false);
    }
  };

  const saveIncome = async () => {
    const amt = Number(incomeAmount);
    if (!amt || amt <= 0 || accounts.length === 0) return;
    setSaving(true);
    try {
      await createTransaction.mutateAsync({
        account_id: accounts[0].id,
        amount: amt,
        currency,
        type: "income",
        description: incomeDesc || "Ingreso inicial",
        transaction_date: format(new Date(), "yyyy-MM-dd"),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    if (dontShowAgain && user) {
      await supabase.from("profiles").update({ onboarding_dismissed: true }).eq("id", user.id);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    }
    onDismiss();
  };

  const steps = [
    // Step 0: Welcome
    <div key="welcome" className="flex flex-col items-center text-center gap-4 py-4">
      <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Sparkles className="h-7 w-7 text-primary" />
      </div>
      <h2 className="text-lg font-heading font-semibold text-foreground">
        Bienvenido a Finanzas con Sentido
      </h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        Tu dinero con calma. Tu vida con sentido. En dos minutos dejamos todo listo para empezar.
      </p>
      <Button onClick={() => setStep(1)} className="w-full mt-2">
        Comenzar <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>,

    // Step 1: Currency
    <div key="currency" className="space-y-4 py-2">
      <h2 className="text-base font-heading font-semibold text-foreground">Tu moneda base</h2>
      <p className="text-xs text-muted-foreground">
        Elige la moneda en la que quieres ver tus totales. Puedes registrar movimientos en otras monedas y se convertirán automáticamente.
      </p>
      <Select value={currency} onValueChange={setCurrency}>
        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="MXN">🇲🇽 Peso Mexicano (MXN)</SelectItem>
          <SelectItem value="USD">🇺🇸 Dólar (USD)</SelectItem>
          <SelectItem value="EUR">🇪🇺 Euro (EUR)</SelectItem>
        </SelectContent>
      </Select>
      <Button onClick={async () => { await saveCurrency(); setStep(2); }} className="w-full">
        Continuar <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>,

    // Step 2: First account
    <div key="account" className="space-y-3 py-2">
      <h2 className="text-base font-heading font-semibold text-foreground">Tu primera cuenta</h2>
      <p className="text-xs text-muted-foreground">
        Agrega tu cuenta principal para empezar a registrar movimientos.
      </p>
      <div className="space-y-2">
        <Label className="text-xs">Nombre</Label>
        <Input placeholder="Ej: Cuenta BBVA" value={accountName} onChange={e => setAccountName(e.target.value)} className="h-9 text-sm" />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Tipo</Label>
        <Select value={accountType} onValueChange={v => setAccountType(v as AccountType)}>
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="bank">Cuenta bancaria</SelectItem>
            <SelectItem value="cash">Efectivo</SelectItem>
            <SelectItem value="savings">Ahorro</SelectItem>
            <SelectItem value="investment">Inversión</SelectItem>
            <SelectItem value="credit_card">Tarjeta de crédito</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Saldo actual</Label>
        <Input type="number" placeholder="0.00" value={accountBalance} onChange={e => setAccountBalance(e.target.value)} className="h-9 text-sm text-right" />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(3)} className="flex-1">Omitir por ahora</Button>
        <Button onClick={async () => { await saveAccount(); setStep(3); }} disabled={!accountName.trim() || saving} className="flex-1">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Crear <ArrowRight className="ml-1 h-4 w-4" /></>}
        </Button>
      </div>
    </div>,

    // Step 3: First income
    <div key="income" className="space-y-3 py-2">
      <h2 className="text-base font-heading font-semibold text-foreground">Tu primer ingreso</h2>
      <p className="text-xs text-muted-foreground">
        Registra tu ingreso principal para que el dashboard muestre datos reales.
      </p>
      {accounts.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Crea una cuenta primero para registrar un ingreso.</p>
      ) : (
        <>
          <div className="space-y-2">
            <Label className="text-xs">Monto</Label>
            <Input type="number" placeholder="0.00" value={incomeAmount} onChange={e => setIncomeAmount(e.target.value)} className="h-9 text-sm text-right" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Descripción</Label>
            <Input placeholder="Ej: Salario" value={incomeDesc} onChange={e => setIncomeDesc(e.target.value)} className="h-9 text-sm" />
          </div>
        </>
      )}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(4)} className="flex-1">Omitir por ahora</Button>
        <Button onClick={async () => { await saveIncome(); setStep(4); }} disabled={!Number(incomeAmount) || accounts.length === 0 || saving} className="flex-1">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Registrar <ArrowRight className="ml-1 h-4 w-4" /></>}
        </Button>
      </div>
    </div>,

    // Step 4: Done
    <div key="done" className="flex flex-col items-center text-center gap-4 py-4">
      <div className="h-14 w-14 rounded-2xl bg-income/10 flex items-center justify-center">
        <CheckCircle2 className="h-7 w-7 text-income" />
      </div>
      <h2 className="text-lg font-heading font-semibold text-foreground">
        ¡Tu tablero está listo para trabajar contigo!
      </h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        Explora las secciones con el ícono <span className="font-medium">?</span> para aprender más sobre cada herramienta.
      </p>
      <div className="flex items-center gap-3 rounded-lg border border-border p-3 w-full">
        <Switch checked={dontShowAgain} onCheckedChange={setDontShowAgain} />
        <Label className="text-xs text-muted-foreground">Ya lo entendí, no mostrar de nuevo</Label>
      </div>
      <Button onClick={handleFinish} className="w-full">
        Ir al dashboard <Wallet className="ml-2 h-4 w-4" />
      </Button>
    </div>,
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onDismiss(); }}>
      <DialogContent className="sm:max-w-[400px] max-h-[90vh] overflow-y-auto">
        {/* Step indicator */}
        <div className="flex gap-1.5 justify-center pt-1 pb-2">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className={`h-1 rounded-full transition-all ${i <= step ? "w-6 bg-primary" : "w-4 bg-muted"}`} />
          ))}
        </div>
        {steps[step]}
      </DialogContent>
    </Dialog>
  );
}
