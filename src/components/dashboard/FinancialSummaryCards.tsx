import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, CreditCard, Wallet, Building2, PiggyBank, TrendingUp, Home, Car, User, Landmark, HandCoins, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccounts, Account, isAssetType, isLiabilityShort, isLiabilityLong, isLiability } from "@/hooks/useAccounts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const typeIcons: Record<string, typeof Wallet> = {
  cash: Wallet, bank: Building2, savings: PiggyBank, investment: TrendingUp,
  credit_card: CreditCard, payable: HandCoins, mortgage: Home, auto_loan: Car,
  personal_loan: User, caucion_bursatil: Landmark,
};

const typeLabels: Record<string, string> = {
  cash: "Efectivo", bank: "Cuenta bancaria", savings: "Ahorro", investment: "Inversión",
  credit_card: "Tarjeta de crédito", payable: "Cuenta por pagar", mortgage: "Crédito hipotecario",
  auto_loan: "Crédito automotriz", personal_loan: "Crédito personal", caucion_bursatil: "Caución bursátil",
};

const fmt = (v: number, currency: string) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(v));

export function FinancialSummaryCards() {
  const navigate = useNavigate();
  const { accounts, assetsByCurrency, liabilitiesByCurrency } = useAccounts();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const assetCurrencies = Object.entries(assetsByCurrency);
  const liabCurrencies = Object.entries(liabilitiesByCurrency);

  const handleCardClick = (key: string) => {
    if (expandedKey === key) {
      // Second click → navigate to accounts
      navigate("/accounts");
    } else {
      setExpandedKey(key);
    }
  };

  const handleAccountClick = (accountId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/accounts/${accountId}`);
  };

  const renderAccountItem = (account: Account) => {
    const Icon = typeIcons[account.type] || Wallet;
    const debt = isLiability(account.type);
    return (
      <div
        key={account.id}
        className="flex items-center gap-3 py-2 px-1 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors"
        onClick={(e) => handleAccountClick(account.id, e)}
      >
        <Icon className={cn("h-4 w-4 shrink-0", debt ? "text-expense" : "text-muted-foreground")} />
        <span className="text-sm text-foreground flex-1 truncate">{account.name}</span>
        <span className={cn("text-sm font-semibold tabular-nums", debt ? "text-expense" : "text-foreground")}>
          {debt && account.current_balance > 0 ? "-" : ""}{fmt(account.current_balance, account.currency)}
        </span>
      </div>
    );
  };

  const getAccountsForCard = (type: "asset" | "liability", currency: string) => {
    if (type === "asset") {
      return accounts.filter(a => isAssetType(a.type) && a.currency === currency).sort((a, b) => a.name.localeCompare(b.name));
    }
    const short = accounts.filter(a => isLiabilityShort(a.type) && a.currency === currency).sort((a, b) => a.name.localeCompare(b.name));
    const long = accounts.filter(a => isLiabilityLong(a.type) && a.currency === currency).sort((a, b) => b.current_balance - a.current_balance);
    return { short, long };
  };

  if (assetCurrencies.length === 0 && liabCurrencies.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
      {/* Assets column */}
      <div className="space-y-3">
        {assetCurrencies.map(([currency, total]) => {
          const key = `asset-${currency}`;
          const isExpanded = expandedKey === key;
          const accs = getAccountsForCard("asset", currency) as Account[];
          return (
            <Collapsible key={key} open={isExpanded}>
              <CollapsibleTrigger asChild>
                <div
                  className="rounded-2xl bg-primary p-4 text-primary-foreground cursor-pointer card-interactive"
                  onClick={() => handleCardClick(key)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck className="h-4 w-4 opacity-80" />
                        <p className="text-xs opacity-80">Activos ({currency})</p>
                      </div>
                      <p className="text-2xl font-bold font-heading">{fmt(total, currency)}</p>
                    </div>
                    <ChevronDown className={cn("h-5 w-5 opacity-60 transition-transform", isExpanded && "rotate-180")} />
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-1 rounded-xl bg-card border border-border p-3 space-y-1">
                  {accs.map(renderAccountItem)}
                  {accs.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Sin cuentas</p>}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      {/* Liabilities column */}
      <div className="space-y-3">
        {liabCurrencies.map(([currency, total]) => {
          const key = `liab-${currency}`;
          const isExpanded = expandedKey === key;
          const { short, long } = getAccountsForCard("liability", currency) as { short: Account[]; long: Account[] };
          return (
            <Collapsible key={key} open={isExpanded}>
              <CollapsibleTrigger asChild>
                <div
                  className="rounded-2xl bg-expense/10 border border-expense/20 p-4 cursor-pointer card-interactive"
                  onClick={() => handleCardClick(key)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <CreditCard className="h-4 w-4 text-expense opacity-80" />
                        <p className="text-xs text-expense opacity-80">Pasivos ({currency})</p>
                      </div>
                      <p className="text-2xl font-bold font-heading text-expense">{fmt(total, currency)}</p>
                    </div>
                    <ChevronDown className={cn("h-5 w-5 text-expense opacity-60 transition-transform", isExpanded && "rotate-180")} />
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-1 rounded-xl bg-card border border-border p-3 space-y-1">
                  {short.length > 0 && (
                    <>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-1">Corto plazo</p>
                      {short.map(renderAccountItem)}
                    </>
                  )}
                  {long.length > 0 && (
                    <>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Largo plazo</p>
                      {long.map(renderAccountItem)}
                    </>
                  )}
                  {short.length === 0 && long.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">Sin pasivos</p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}