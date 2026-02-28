import { useState, useEffect } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [hasMovements, setHasMovements] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    if (account && open) {
      setName(account.name);
      setType(account.type);
      setNewBalance(String(account.current_balance));
      setShowConfirmDialog(false);
      fetchLastTransaction(account.id);
      checkHasMovements(account.id);
    }
  }, [account, open]);

  const checkHasMovements = async (accountId: string) => {
    const [txCount, trFromCount, trToCount] = await Promise.all([
      supabase.from("transactions").select("id", { count: "exact", head: true }).eq("account_id", accountId),
      supabase.from("transfers").select("id", { count: "exact", head: true }).eq("from_account_id", accountId),
      supabase.from("transfers").select("id", { count: "exact", head: true }).eq("to_account_id", accountId),
    ]);
    const total = (txCount.count ?? 0) + (trFromCount.count ?? 0) + (trToCount.count ?? 0);
    setHasMovements(total > 0);
  };

  const fetchLastTransaction = async (accountId: string) => {
    const [txRes, trFromRes, trToRes] = await Promise.all([
      supabase.from("transactions").select("description, amount, type, transaction_date, currency")
        .eq("account_id", accountId).order("transaction_date", { ascending: false }).limit(1),
      supabase.from("transfers").select("description, amount_from, transfer_date, currency_from, from_account_id, to_account_id")
        .eq("from_account_id", accountId).order("transfer_date", { ascending: false }).limit(1),
      supabase.from("transfers").select("description, amount_to, transfer_date, currency_to, from_account_id, to_account_id")
        .eq("to_account_id", accountId).order("transfer_date", { ascending: false }).limit(1),
    ]);

    const candidates: { date: string; data: LastTransaction }[] = [];

    if (txRes.data?.[0]) {
      const t = txRes.data[0];
      candidates.push({ date: t.transaction_date, data: { description: t.description, amount: t.amount, type: t.type, transaction_date: t.transaction_date } });
    }
    if (trFromRes.data?.[0]) {
      const t = trFromRes.data[0];
      candidates.push({ date: t.transfer_date, data: { description: t.description || "Transferencia enviada", amount: t.amount_from, type: "transfer_out", transaction_date: t.transfer_date } });
    }
    if (trToRes.data?.[0]) {
      const t = trToRes.data[0];
      candidates.push({ date: t.transfer_date, data: { description: t.description || "Transferencia recibida", amount: t.amount_to, type: "transfer_in", transaction_date: t.transfer_date } });
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.date.localeCompare(a.date));
      setLastTx(candidates[0].data);
    } else {
      setLastTx(null);
    }
  };

  const fmt = (v: number, currency: string) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency, minimumFractionDigits: 2 }).format(v);

  const parsedBalance = parseFloat(newBalance);
  const balanceDiff = !isNaN(parsedBalance) && account ? parsedBalance - account.current_balance : 0;
  const hasDiff = Math.abs(balanceDiff) > 0.01;

  const handleSaveClick = () => {
    if (!account) return;
    // If balance changed and account has movements, show confirmation dialog
    if (hasDiff && hasMovements) {
      setShowConfirmDialog(true);
      return;
    }
    executeSave();
  };

  const executeSave = async () => {
    if (!account) return;
    setIsSaving(true);
    setShowConfirmDialog(false);
    try {
      const balanceChanged = hasDiff && !isNaN(parsedBalance);

      // Update name/type only (never update current_balance directly)
      await updateAccount.mutateAsync({
        id: account.id,
        name,
        type: type as Account["type"],
      });

      // If balance changed, create an adjustment transaction
      // The DB trigger on transactions will handle updating current_balance
      if (balanceChanged && user) {
        const diff = parsedBalance - account.current_balance;
        await supabase.from("transactions").insert({
          user_id: user.id,
          account_id: account.id,
          type: diff > 0 ? "adjustment_income" : "adjustment_expense",
          amount: Math.abs(diff),
          currency: account.currency,
          description: "Ajuste de saldo",
          notes: `Saldo ajustado de ${fmt(account.current_balance, account.currency)} a ${fmt(parsedBalance, account.currency)}`,
          transaction_date: format(new Date(), "yyyy-MM-dd"),
        });
      }

      // Invalidate all relevant queries to refresh everywhere
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      ]);

      toast({ title: "Cuenta actualizada" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!account) return null;

  return (
    <>
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
                onChange={(e) => setNewBalance(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Saldo registrado: {fmt(account.current_balance, account.currency)}
              </p>
            </div>

            {lastTx && (
              <div className="rounded-xl bg-secondary/50 border border-border p-4 space-y-2">
                <p className="text-sm text-foreground font-medium">Último movimiento registrado</p>
                <p className="text-xs text-muted-foreground">
                  {lastTx.type === "expense" ? "Gasto" : lastTx.type === "income" ? "Ingreso" : lastTx.type === "transfer_out" ? "Transferencia enviada" : lastTx.type === "transfer_in" ? "Transferencia recibida" : "Transferencia"}{" "}
                  de <span className="font-medium text-foreground">{fmt(lastTx.amount, account.currency)}</span>
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

            {!lastTx && hasDiff && (
              <div className="rounded-xl bg-secondary/50 border border-border p-4">
                <p className="text-xs text-muted-foreground">
                  Se registrará un ajuste de saldo por{" "}
                  <span className={balanceDiff > 0 ? "text-income font-medium" : "text-expense font-medium"}>
                    {balanceDiff > 0 ? "+" : ""}{fmt(balanceDiff, account.currency)}
                  </span>.
                </p>
              </div>
            )}

            {hasMovements && hasDiff && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 flex gap-3 items-start">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Esta cuenta tiene movimientos registrados. Al cambiar el saldo se creará una transacción de ajuste para mantener la trazabilidad.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSaveClick} disabled={isSaving || !name.trim()}>
                {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : "Guardar"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirmation dialog for balance adjustment with existing movements */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ajuste de saldo</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                Esta cuenta ya tiene movimientos registrados.
              </span>
              <span className="block">
                ¿El saldo que vas a poner ({fmt(parsedBalance, account.currency)}) es el saldo real después del último movimiento registrado?
              </span>
              <span className="block font-medium text-foreground">
                Si confirmas, se creará un ajuste por{" "}
                <span className={balanceDiff > 0 ? "text-income" : "text-expense"}>
                  {balanceDiff > 0 ? "+" : ""}{fmt(balanceDiff, account.currency)}
                </span>{" "}
                y este saldo se tomará como la nueva verdad a partir de hoy.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeSave}>
              Confirmar ajuste
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
