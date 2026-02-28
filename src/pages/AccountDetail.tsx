import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccounts } from "@/hooks/useAccounts";
import { useTransactions } from "@/hooks/useTransactions";
import { useTransfers } from "@/hooks/useTransfers";
import { useCategories } from "@/hooks/useCategories";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const { accounts } = useAccounts();
  const { transactions } = useTransactions();
  const { transfers } = useTransfers(id);
  const { categories } = useCategories();
  const account = accounts.find((a) => a.id === id);

  if (!account) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Cuenta no encontrada</p>
        <Link to="/accounts"><Button variant="outline" className="mt-4">Volver</Button></Link>
      </div>
    );
  }

  const accountTxs = transactions.filter((t) => t.account_id === id);
  const getAccountName = (accId: string) => accounts.find((a) => a.id === accId)?.name ?? "—";
  const getCategoryName = (catId: string | null) => categories.find((c) => c.id === catId)?.name ?? "";

  const fmt = (amount: number, currency: string) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(amount);

  const allItems = [
    ...accountTxs.map((t) => ({
      id: t.id,
      date: t.transaction_date,
      type: t.type as string,
      description: t.description || getCategoryName(t.category_id),
      amount: t.type === "expense" ? -t.amount : t.amount,
      currency: t.currency,
      source: "tx" as const,
    })),
    ...transfers.map((t) => ({
      id: t.id,
      date: t.transfer_date,
      type: "transfer",
      description: t.from_account_id === id
        ? `→ ${getAccountName(t.to_account_id)}`
        : `← ${getAccountName(t.from_account_id)}`,
      amount: t.from_account_id === id ? -t.amount_from : t.amount_to,
      currency: t.from_account_id === id ? t.currency_from : t.currency_to,
      source: "transfer" as const,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const renderItem = (item: typeof allItems[0]) => (
    <div key={item.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{item.description || item.type}</p>
        <p className="text-xs text-muted-foreground">{format(new Date(item.date), "d MMM yyyy", { locale: es })}</p>
      </div>
      <p className={cn("font-semibold tabular-nums text-sm", item.amount < 0 ? "text-expense" : "text-income")}>
        {item.amount < 0 ? "-" : "+"}{fmt(Math.abs(item.amount), item.currency)}
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-3 -mx-1 px-1 pt-1">
        <div className="flex items-center gap-3">
          <Link to="/accounts">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">{account.name}</h1>
            <p className="text-muted-foreground text-sm">{account.currency} · Saldo: {fmt(account.current_balance, account.currency)}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">Todo ({allItems.length})</TabsTrigger>
          <TabsTrigger value="movements">Movimientos ({accountTxs.length})</TabsTrigger>
          <TabsTrigger value="transfers">Transferencias ({transfers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <div className="rounded-2xl bg-card border border-border p-4">
            {allItems.length === 0 ? (
              <p className="text-center py-8 text-sm text-muted-foreground">Sin movimientos</p>
            ) : allItems.map(renderItem)}
          </div>
        </TabsContent>

        <TabsContent value="movements">
          <div className="rounded-2xl bg-card border border-border p-4">
            {accountTxs.length === 0 ? (
              <p className="text-center py-8 text-sm text-muted-foreground">Sin movimientos</p>
            ) : accountTxs.map((t) => renderItem({
              id: t.id,
              date: t.transaction_date,
              type: t.type,
              description: t.description || getCategoryName(t.category_id),
              amount: t.type === "expense" ? -t.amount : t.amount,
              currency: t.currency,
              source: "tx",
            }))}
          </div>
        </TabsContent>

        <TabsContent value="transfers">
          <div className="rounded-2xl bg-card border border-border p-4">
            {transfers.length === 0 ? (
              <p className="text-center py-8 text-sm text-muted-foreground">Sin transferencias</p>
            ) : transfers.map((t) => renderItem({
              id: t.id,
              date: t.transfer_date,
              type: "transfer",
              description: t.from_account_id === id
                ? `→ ${getAccountName(t.to_account_id)}`
                : `← ${getAccountName(t.from_account_id)}`,
              amount: t.from_account_id === id ? -t.amount_from : t.amount_to,
              currency: t.from_account_id === id ? t.currency_from : t.currency_to,
              source: "transfer",
            }))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
