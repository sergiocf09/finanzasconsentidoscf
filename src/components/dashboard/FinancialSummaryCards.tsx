import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, CreditCard, Wallet, Building2, PiggyBank, TrendingUp, Home, Car, User, Landmark, HandCoins, ChevronDown, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrencyAbs } from "@/lib/formatters";
import { useAccounts, Account, isAssetType, isLiabilityShort, isLiabilityLong, isLiability } from "@/hooks/useAccounts";
  import { useHideAmounts } from "@/hooks/useHideAmounts";

const typeIcons: Record<string, typeof Wallet> = {
  cash: Wallet, bank: Building2, savings: PiggyBank, investment: TrendingUp,
  credit_card: CreditCard, payable: HandCoins, mortgage: Home, auto_loan: Car,
  personal_loan: User, caucion_bursatil: Landmark,
};

const fmt = (v: number, currency: string) => formatCurrencyAbs(v, currency);

export function FinancialSummaryCards() {
  const navigate = useNavigate();
  const { accounts, assetsByCurrency, liabilitiesByCurrency } = useAccounts();
  const { hidden, toggle, mask } = useHideAmounts("balances");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const assetCurrencies = Object.entries(assetsByCurrency);
  const liabCurrencies = Object.entries(liabilitiesByCurrency);

  const handleCardClick = (key: string) => {
    setExpandedKey(expandedKey === key ? null : key);
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
        className="flex items-center gap-2 py-1.5 px-2 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors"
        onClick={(e) => handleAccountClick(account.id, e)}
      >
        <Icon className={cn("h-3.5 w-3.5 shrink-0", debt ? "text-expense" : "text-income")} />
        <span className="text-xs text-foreground flex-1 truncate">{account.name}</span>
        <span className={cn("text-xs font-semibold tabular-nums", debt ? "text-expense" : "text-income")}>
          {debt && account.current_balance !== 0 ? "-" : ""}{mask(fmt(account.current_balance, account.currency))}
        </span>
      </div>
    );
  };

  const getAccountsForCard = (type: "asset" | "liability", currency: string) => {
    if (type === "asset") {
      return accounts.filter(a => a.is_active && isAssetType(a.type) && a.currency === currency).sort((a, b) => a.name.localeCompare(b.name));
    }
    const short = accounts.filter(a => a.is_active && isLiabilityShort(a.type) && a.currency === currency).sort((a, b) => a.name.localeCompare(b.name));
    const long = accounts.filter(a => a.is_active && isLiabilityLong(a.type) && a.currency === currency).sort((a, b) => b.current_balance - a.current_balance);
    return { short, long };
  };

  if (assetCurrencies.length === 0 && liabCurrencies.length === 0) {
    return null;
  }

  const allCurrencies = Array.from(new Set([...assetCurrencies.map(([c]) => c), ...liabCurrencies.map(([c]) => c)]));

  return (
    <div className="space-y-2">
      {/* Eye toggle */}
      <div className="flex justify-end">
        <button onClick={toggle} className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors" title={hidden ? "Mostrar montos" : "Ocultar montos"}>
          {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {/* Summary cards: two columns */}
      <div className="grid grid-cols-2 gap-2">
        {/* Left: Assets */}
        <div className="space-y-2">
          {allCurrencies.map(currency => {
            const total = assetsByCurrency[currency];
            if (total === undefined) return null;
            const key = `asset-${currency}`;
            const isExpanded = expandedKey === key;
            return (
              <div
                key={key}
                className="rounded-xl bg-income/10 border border-income/20 p-3 cursor-pointer card-interactive"
                onClick={() => handleCardClick(key)}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-income shrink-0" />
                      <p className="text-[10px] font-semibold text-income truncate">Activos {currency}</p>
                    </div>
                    <p className="text-lg font-bold font-heading text-income leading-tight">{mask(fmt(total, currency))}</p>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 text-income opacity-60 transition-transform shrink-0", isExpanded && "rotate-180")} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Liabilities */}
        <div className="space-y-2">
          {allCurrencies.map(currency => {
            const total = liabilitiesByCurrency[currency];
            if (total === undefined) return null;
            const key = `liab-${currency}`;
            const isExpanded = expandedKey === key;
            return (
              <div
                key={key}
                className="rounded-xl bg-expense/10 border border-expense/20 p-3 cursor-pointer card-interactive"
                onClick={() => handleCardClick(key)}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <CreditCard className="h-3.5 w-3.5 text-expense opacity-80 shrink-0" />
                      <p className="text-[10px] font-semibold text-expense truncate">Pasivos {currency}</p>
                    </div>
                    <p className="text-lg font-bold font-heading text-expense leading-tight">{hidden ? "••••••" : `-${fmt(total, currency)}`}</p>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 text-expense opacity-60 transition-transform shrink-0", isExpanded && "rotate-180")} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded detail: full width, centered, 80% */}
      {expandedKey && (
        <div className="flex justify-center">
          <div className="w-[85%] rounded-xl bg-card border border-border p-3 space-y-1">
            {expandedKey.startsWith("asset-") && (() => {
              const currency = expandedKey.replace("asset-", "");
              const accs = getAccountsForCard("asset", currency) as Account[];
              return accs.length > 0
                ? accs.map(renderAccountItem)
                : <p className="text-[10px] text-muted-foreground text-center py-1">Sin cuentas</p>;
            })()}
            {expandedKey.startsWith("liab-") && (() => {
              const currency = expandedKey.replace("liab-", "");
              const { short, long } = getAccountsForCard("liability", currency) as { short: Account[]; long: Account[] };
              return (
                <>
                  {short.length > 0 && (
                    <>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Corto plazo</p>
                      {short.map(renderAccountItem)}
                    </>
                  )}
                  {long.length > 0 && (
                    <>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide pt-1">Largo plazo</p>
                      {long.map(renderAccountItem)}
                    </>
                  )}
                  {short.length === 0 && long.length === 0 && (
                    <p className="text-[10px] text-muted-foreground text-center py-1">Sin pasivos</p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

    </div>
  );
}
