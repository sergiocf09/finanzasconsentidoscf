import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAccounts } from "@/hooks/useAccounts";
import { useTransfers } from "@/hooks/useTransfers";
import { format } from "date-fns";

const schema = z.object({
  from_account_id: z.string().min(1, "Selecciona cuenta origen"),
  to_account_id: z.string().min(1, "Selecciona cuenta destino"),
  amount: z.coerce.number().positive("Monto debe ser mayor a 0"),
  transfer_date: z.string(),
  description: z.string().optional(),
}).refine((d) => d.from_account_id !== d.to_account_id, {
  message: "Origen y destino deben ser diferentes",
  path: ["to_account_id"],
});

type FormValues = z.infer<typeof schema>;

interface TransferFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransferForm({ open, onOpenChange }: TransferFormProps) {
  const { accounts } = useAccounts();
  const { createTransfer } = useTransfers();
  const activeAccounts = accounts.filter((a) => a.is_active);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      from_account_id: "",
      to_account_id: "",
      amount: 0,
      transfer_date: format(new Date(), "yyyy-MM-dd"),
      description: "",
    },
  });

  const fromId = form.watch("from_account_id");
  const fromAccount = activeAccounts.find((a) => a.id === fromId);
  const toId = form.watch("to_account_id");
  const toAccount = activeAccounts.find((a) => a.id === toId);
  const needsFx = fromAccount && toAccount && fromAccount.currency !== toAccount.currency;

  const onSubmit = async (data: FormValues) => {
    const from = activeAccounts.find((a) => a.id === data.from_account_id)!;
    const to = activeAccounts.find((a) => a.id === data.to_account_id)!;

    await createTransfer.mutateAsync({
      from_account_id: data.from_account_id,
      to_account_id: data.to_account_id,
      amount_from: data.amount,
      currency_from: from.currency,
      amount_to: data.amount, // same if same currency
      currency_to: to.currency,
      fx_rate: from.currency !== to.currency ? 1 : undefined,
      transfer_date: data.transfer_date,
      description: data.description || undefined,
    });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva transferencia</DialogTitle>
          <DialogDescription>Mueve dinero entre tus cuentas</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="from_account_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Cuenta origen</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {activeAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="to_account_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Cuenta destino</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {activeAccounts.filter((a) => a.id !== fromId).map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Monto {fromAccount ? `(${fromAccount.currency})` : ""}</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {needsFx && (
              <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                Monedas diferentes ({fromAccount?.currency} → {toAccount?.currency}). El monto se registrará en ambas monedas con el mismo valor. Puedes ajustar después.
              </p>
            )}

            <FormField control={form.control} name="transfer_date" render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Concepto (opcional)</FormLabel>
                <FormControl><Input placeholder="Ej: Pago de tarjeta" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={createTransfer.isPending}>
                {createTransfer.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Transferir
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
