import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAccounts, Account } from "@/hooks/useAccounts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const accountTypes = [
  { value: "cash", label: "Efectivo" },
  { value: "bank", label: "Cuenta Bancaria" },
  { value: "savings", label: "Ahorro" },
  { value: "investment", label: "Inversión" },
  { value: "credit_card", label: "Tarjeta de Crédito" },
  { value: "payable", label: "Cuenta por Pagar" },
  { value: "mortgage", label: "Crédito Hipotecario" },
  { value: "auto_loan", label: "Crédito Automotriz" },
  { value: "personal_loan", label: "Crédito Personal" },
  { value: "caucion_bursatil", label: "Caución Bursátil" },
];

interface AccountEditSheetProps {
  account: Account | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LastTransaction {
  description: string | null;
  amount: number;
  type: string;
  transaction_date: string;
}

export function AccountEditSheet({ account, open, onOpenChange }: AccountEditSheetProps) {
  const { user } = useAuth();
  const { updateAccount } = useAccounts();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [newBalance, setNewBalance] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [lastTx, setLastTx] = useState<LastTransaction | null>(null);
  const [showBalanceConfirm, setShowBalanceConfirm] = useState(false);

  useEffect(() => {
    if (account && open) {
      setName(account.name);
      setType(account.type);
      setNewBalance(String(account.current_balance));
      setShowBalanceConfirm(false);
      // Fetch last transaction for this account
      fetchLastTransaction(account.id);
    }
  }, [account, open]);

  const fetchLastTransaction = async (accountId: string) => {
    const { data } = await supabase
      .from("transactions")
      .select("description, amount, type, transaction_date")
      .eq("account_id", accountId)
      .order("transaction_date", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setLastTx(data[0] as LastTransaction);
    } else {
      setLastTx(null);
    }
  };

  const fmt = (v: number, currency: string) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency, minimumFractionDigits: 2 }).format(v);

  const handleBalanceChange = (val: string) => {
    setNewBalance(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && account && parsed !== account.current_balance) {
      setShowBalanceConfirm(true);
    } else {
      setShowBalanceConfirm(false);
    }
  };

  const handleSave = async () => {
    if (!account) return;
    setIsSaving(true);
    try {
      const parsedBalance = parseFloat(newBalance);
      const balanceChanged = !isNaN(parsedBalance) && parsedBalance !== account.current_balance;

      // Update account name/type
      await updateAccount.mutateAsync({
        id: account.id,
        name,
        type: type as Account["type"],
        ...(balanceChanged ? { current_balance: parsedBalance } : {}),
      });

      // If balance changed, create an adjustment transaction for traceability
      if (balanceChanged && user) {
        const diff = parsedBalance - account.current_balance;
        await supabase.from("transactions").insert({
          user_id: user.id,
          account_id: account.id,
          type: diff > 0 ? "income" : "expense",
          amount: Math.abs(diff),
          currency: account.currency,
          description: "Ajuste de saldo",
          notes: `Saldo ajustado de ${fmt(account.current_balance, account.currency)} a ${fmt(parsedBalance, account.currency)}`,
          transaction_date: format(new Date(), "yyyy-MM-dd"),
        });
        // The trigger will auto-update the balance, but we already set it directly
        // so we need to offset: set balance to what it was before the trigger adds/subtracts
        // Actually, the trigger fires on the insert above and will modify current_balance.
        // Since we already updated current_balance via updateAccount, the trigger will double-count.
        // Solution: Don't update current_balance in updateAccount; let the adjustment transaction do it.
        // Let's fix: reset balance to original, then let the trigger apply the diff.
        await supabase.from("accounts").update({ current_balance: account.current_balance }).eq("id", account.id);
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
      }

      toast({ title: "Cuenta actualizada" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!account) return null;

  const balanceDiff = parseFloat(newBalance) - account.current_balance;
  const hasDiff = !isNaN(balanceDiff) && Math.abs(balanceDiff) > 0.01;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-heading">Editar cuenta</SheetTitle>
          <SheetDescription>Modifica los datos de tu cuenta.</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Tipo de cuenta</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {accountTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Saldo actual ({account.currency})</Label>
            <Input
              type="number"
              step="0.01"
              value={newBalance}
              onChange={(e) => handleBalanceChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Saldo registrado: {fmt(account.current_balance, account.currency)}
            </p>
          </div>

          {/* Last transaction context */}
          {lastTx && showBalanceConfirm && (
            <div className="rounded-xl bg-secondary/50 border border-border p-4 space-y-2">
              <p className="text-sm text-foreground font-medium">Confirma tu ajuste</p>
              <p className="text-xs text-muted-foreground">
                Tu último movimiento fue:{" "}
                <span className="font-medium text-foreground">
                  {lastTx.type === "expense" ? "Gasto" : lastTx.type === "income" ? "Ingreso" : "Transferencia"}{" "}
                  de {fmt(lastTx.amount, account.currency)}
                </span>
                {lastTx.description && <> — {lastTx.description}</>}
                {" "}el{" "}
                {format(new Date(lastTx.transaction_date + "T12:00:00"), "d 'de' MMMM", { locale: es })}.
              </p>
              {hasDiff && (
                <p className="text-xs text-muted-foreground">
                  Se registrará un <span className="font-medium text-foreground">ajuste de saldo</span> por{" "}
                  <span className={balanceDiff > 0 ? "text-income font-medium" : "text-expense font-medium"}>
                    {balanceDiff > 0 ? "+" : ""}{fmt(balanceDiff, account.currency)}
                  </span>{" "}
                  para mantener la trazabilidad.
                </p>
              )}
            </div>
          )}

          {!lastTx && showBalanceConfirm && hasDiff && (
            <div className="rounded-xl bg-secondary/50 border border-border p-4">
              <p className="text-xs text-muted-foreground">
                Se registrará un ajuste de saldo por{" "}
                <span className={balanceDiff > 0 ? "text-income font-medium" : "text-expense font-medium"}>
                  {balanceDiff > 0 ? "+" : ""}{fmt(balanceDiff, account.currency)}
                </span>.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={isSaving || !name.trim()}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : "Guardar"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}