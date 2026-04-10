import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(1, "Ingresa un nombre"),
  type: z.enum(["savings", "investment"]).default("savings"),
  currency: z.string().default("MXN"),
  initial_balance: z.coerce.number().default(0),
});

type FormValues = z.infer<typeof schema>;

const FieldRow = ({
  label, children, hint,
}: {
  label: string; children: React.ReactNode; hint?: string;
}) => (
  <div className="flex items-center gap-3 min-h-[2rem]">
    <div className="w-[40%] shrink-0">
      <Label className="text-xs text-muted-foreground leading-tight">
        {label}
      </Label>
      {hint && (
        <p className="text-[10px] text-muted-foreground/60 leading-tight">
          {hint}
        </p>
      )}
    </div>
    <div className="flex-1">{children}</div>
  </div>
);

interface MiniAccountFormProps {
  suggestedName: string;
  onCreated: (accountId: string, accountName: string) => void;
  onCancel: () => void;
}

export function MiniAccountForm({
  suggestedName, onCreated, onCancel,
}: MiniAccountFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: suggestedName || "",
      type: "savings",
      currency: "MXN",
      initial_balance: 0,
    },
  });

  useEffect(() => {
    if (suggestedName) form.setValue("name", suggestedName);
  }, [suggestedName, form]);

  const onSubmit = async (data: FormValues) => {
    if (!user) return;
    setIsPending(true);
    try {
      const { data: newAccount, error } = await supabase
        .from("accounts")
        .insert({
          user_id: user.id,
          name: data.name,
          type: data.type,
          currency: data.currency,
          initial_balance: data.initial_balance,
          current_balance: data.initial_balance,
        })
        .select()
        .single();

      if (error || !newAccount) {
        toast({
          title: "Error al crear la cuenta",
          description: error?.message,
          variant: "destructive",
        });
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      onCreated(newAccount.id, newAccount.name);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
      <FieldRow label="Nombre de cuenta">
        <Input className="h-8 text-sm" {...form.register("name")} />
      </FieldRow>
      {form.formState.errors.name && (
        <p className="text-xs text-destructive pl-[40%]">
          {form.formState.errors.name.message}
        </p>
      )}

      <FieldRow label="Tipo de cuenta">
        <Select
          value={form.watch("type")}
          onValueChange={(v) =>
            form.setValue("type", v as "savings" | "investment")
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="savings">
              Ahorro — corto y mediano plazo
            </SelectItem>
            <SelectItem value="investment">
              Inversión — largo plazo / rendimiento
            </SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Moneda">
        <Select
          value={form.watch("currency")}
          onValueChange={(v) => form.setValue("currency", v)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MXN">Peso Mexicano (MXN)</SelectItem>
            <SelectItem value="USD">Dólar (USD)</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Saldo inicial">
        <Input
          className="h-8 text-sm text-right"
          type="number"
          step="0.01"
          {...form.register("initial_balance")}
        />
      </FieldRow>

      <div className="flex gap-3 pt-3 border-t border-border mt-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creando...
            </>
          ) : (
            "Crear cuenta"
          )}
        </Button>
      </div>
    </form>
  );
}
