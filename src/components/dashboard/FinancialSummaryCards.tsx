import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck, CreditCard, Wallet, Building2, PiggyBank, TrendingUp,
  Home, Car, User, Landmark, HandCoins, ChevronDown, Eye, EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrencyAbs } from "@/lib/formatters";
import { useAccounts, Account, isAssetType, isLiabilityShort, isLiabilityLong, isLiability } from "@/hooks/useAccounts";
import { useHideAmounts } from "@/hooks/useHideAmounts";
import { useExchangeRate } from "@/hooks/useExchangeRate";

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
  const { convertToMXN } = useExchangeRate();
  const [expanded, setExpanded] = useState<"assets" | "liabilities" | null>(null);

  // Compute totals in MXN
  const totalAssetsMXN = Object.entries(assetsByCurrency).reduce(
    (sum, [currency, amount]) => sum + convertToMXN(amount, currency), 0
  );
  const totalLiabilitiesMXN = Object.entries(liabilitiesByCurrency).reduce(
    (sum, [currency, amount]) => sum + convertToMXN(amount, currency), 0
  );

  const hasData = totalAssetsMXN > 0 || totalLiabilitiesMXN > 0 || accounts.some(a => a.is_active);
  if (!hasData) return null;

  const allCurrencies = Array.from(
    new Set(accounts.filter(a => a.is_active).map(a => a.currency))
  ).sort((a, b) => (a === "MXN" ? -1 : b === "MXN" ? 1 : a.localeCompare(b)));

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
          {debt && account.current_balance !== 0 ? "-" : ""}
          {mask(fmt(Math.abs(account.current_balance), account.currency))}
        </span>
      </div>
    );
  };

  const renderExpandedSection = (type: "assets" | "liabilities") => {
    const isAsset = type === "assets";

    return (
      <div className="flex justify-center">
        <div className="w-[90%] rounded-xl bg-card border border-border p-3 space-y-2">
          {allCurrencies.map(currency => {
            let accsForCurrency: Account[];
            let subtotal: number;

            if (isAsset) {
              accsForCurrency = accounts
                .filter(a => a.is_active && isAssetType(a.type) && a.currency === currency)
                .sort((a, b) => a.name.localeCompare(b.name));
              subtotal = assetsByCurrency[currency] || 0;
            } else {
              accsForCurrency = accounts
                .filter(a => a.is_active && isLiability(a.type) && a.currency === currency)
                .sort((a, b) => Math.abs(b.current_balance) - Math.abs(a.current_balance));
              subtotal = liabilitiesByCurrency[currency] || 0;
            }

            if (accsForCurrency.length === 0) return null;

            // Group liabilities by short/long
            const shortAccs = isAsset ? [] : accsForCurrency.filter(a => isLiabilityShort(a.type));
            const longAccs = isAsset ? [] : accsForCurrency.filter(a => isLiabilityLong(a.type));

            return (
              <div key={currency} className="space-y-1">
                {/* Currency subtotal header */}
                <div className="flex items-center justify-between px-1 py-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {currency}
                  </span>
                  <span className={cn(
                    "text-xs font-bold tabular-nums",
                    isAsset ? "text-income" : "text-expense"
                  )}>
                    {!isAsset && subtotal !== 0 ? "-" : ""}
                    {mask(fmt(Math.abs(subtotal), currency))}
                  </span>
                </div>

                {/* Account list */}
                {isAsset ? (
                  accsForCurrency.map(renderAccountItem)
                ) : (
                  <>
                    {shortAccs.length > 0 && (
                      <>
                        <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide px-2">Corto plazo</p>
                        {shortAccs.map(renderAccountItem)}
                      </>
                    )}
                    {longAccs.length > 0 && (
                      <>
                        <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide px-2 pt-0.5">Largo plazo</p>
                        {longAccs.map(renderAccountItem)}
                      </>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {/* Eye toggle */}
      <div className="flex justify-end">
        <button
          onClick={toggle}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          title={hidden ? "Mostrar montos" : "Ocultar montos"}
        >
          {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {/* Two cards: Assets | Liabilities */}
      <div className="grid grid-cols-2 gap-2">
        {/* Assets card */}
        <div
          className="rounded-xl bg-income/10 border border-income/20 p-3 cursor-pointer card-interactive"
          onClick={() => setExpanded(expanded === "assets" ? null : "assets")}
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <ShieldCheck className="h-3.5 w-3.5 text-income shrink-0" />
                <p className="text-[10px] font-semibold text-income truncate">Activos</p>
              </div>
              <p className="text-lg font-bold font-heading text-income leading-tight">
                {mask(fmt(totalAssetsMXN, "MXN"))}
              </p>
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 text-income opacity-60 transition-transform shrink-0",
              expanded === "assets" && "rotate-180"
            )} />
          </div>
        </div>

        {/* Liabilities card */}
        <div
          className="rounded-xl bg-expense/10 border border-expense/20 p-3 cursor-pointer card-interactive"
          onClick={() => setExpanded(expanded === "liabilities" ? null : "liabilities")}
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <CreditCard className="h-3.5 w-3.5 text-expense shrink-0" />
                <p className="text-[10px] font-semibold text-expense truncate">Pasivos</p>
              </div>
              <p className="text-lg font-bold font-heading text-expense leading-tight">
                {hidden ? "••••••" : `-${fmt(totalLiabilitiesMXN, "MXN")}`}
              </p>
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 text-expense opacity-60 transition-transform shrink-0",
              expanded === "liabilities" && "rotate-180"
            )} />
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && renderExpandedSection(expanded)}
    </div>
  );
}
