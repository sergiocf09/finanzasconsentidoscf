import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck, CreditCard, Wallet, Building2, PiggyBank, TrendingUp,
  Home, Car, User, Landmark, HandCoins, ChevronDown, Eye, EyeOff,
  Sofa, Gem, Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { useAccounts, isAssetType, isLiabilityShort, isLiabilityLong, isLiability } from "@/hooks/useAccounts";
import { useHideAmounts } from "@/hooks/useHideAmounts";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { DashboardSummary } from "@/hooks/useDashboardSummary";

type AccountSummaryItem = NonNullable<DashboardSummary["accounts_summary"]>[number];

const typeIcons: Record<string, typeof Wallet> = {
  cash: Wallet, bank: Building2, savings: PiggyBank, investment: TrendingUp,
  credit_card: CreditCard, payable: HandCoins, mortgage: Home, auto_loan: Car,
  personal_loan: User, caucion_bursatil: Landmark,
};

const fmt = (v: number, currency: string) => formatCurrency(v, currency);

interface FinancialSummaryCardsProps {
  accountsSummary?: AccountSummaryItem[];
}

export function FinancialSummaryCards({ accountsSummary }: FinancialSummaryCardsProps) {
  const navigate = useNavigate();
  const { accounts: hookAccounts } = useAccounts({ enabled: !accountsSummary });
  const { hidden, toggle, mask } = useHideAmounts("balances");
  const { convertToMXN } = useExchangeRate();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<"assets" | "liabilities" | null>(null);

  const accounts = useMemo(() => {
    if (accountsSummary) {
      return accountsSummary.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        currency: a.currency,
        current_balance: a.current_balance,
        is_active: a.is_active,
        include_in_summary: (a as any).include_in_summary !== false,
      }));
    }
    return hookAccounts.map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      current_balance: a.current_balance,
      is_active: a.is_active,
      include_in_summary: a.include_in_summary !== false,
    }));
  }, [accountsSummary, hookAccounts]);

  const activeOnly = useMemo(() => accounts.filter(a => a.is_active), [accounts]);

  // Group balances by currency
  const { assetsByCurrency, liabilitiesByCurrency } = useMemo(() => {
    const assets: Record<string, number> = {};
    const liabilities: Record<string, number> = {};
    activeOnly
      .filter(acc => acc.include_in_summary !== false)
      .forEach(acc => {
        if (isAssetType(acc.type)) {
          assets[acc.currency] = (assets[acc.currency] ?? 0) + (acc.current_balance ?? 0);
        } else if (isLiability(acc.type)) {
          liabilities[acc.currency] = (liabilities[acc.currency] ?? 0) + Math.abs(acc.current_balance ?? 0);
        }
      });
    return { assetsByCurrency: assets, liabilitiesByCurrency: liabilities };
  }, [activeOnly]);

  // Compute totals in MXN
  const totalAssetsMXN = Object.entries(assetsByCurrency).reduce(
    (sum, [currency, amount]) => sum + convertToMXN(amount, currency), 0
  );
  const totalLiabilitiesMXN = Object.entries(liabilitiesByCurrency).reduce(
    (sum, [currency, amount]) => sum + convertToMXN(amount, currency), 0
  );

  const hasData = totalAssetsMXN > 0 || totalLiabilitiesMXN > 0 || activeOnly.length > 0;
  if (!hasData) return null;

  const allCurrencies = Array.from(
    new Set(activeOnly.map(a => a.currency))
  ).sort((a, b) => (a === "MXN" ? -1 : b === "MXN" ? 1 : a.localeCompare(b)));

  const handleAccountClick = (accountId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/accounts/${accountId}`);
  };

  const toggleIncludeInSummary = async (accountId: string, currentValue: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase
      .from("accounts")
      .update({ include_in_summary: !currentValue } as any)
      .eq("id", accountId);
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard_summary"] });
  };

  const renderAccountItem = (account: typeof accounts[0]) => {
    const Icon = typeIcons[account.type] || Wallet;
    const debt = isLiability(account.type);
    const included = account.include_in_summary !== false;

    return (
      <div
        key={account.id}
        className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors"
      >
        <div className="cursor-pointer" onClick={(e) => handleAccountClick(account.id, e)}>
          <Icon className={cn("h-3.5 w-3.5 shrink-0", debt ? "text-expense" : "text-income")} />
        </div>
        <span
          className={cn("text-xs flex-1 truncate cursor-pointer", !included && "text-muted-foreground")}
          onClick={(e) => handleAccountClick(account.id, e)}
        >
          {account.name}
          {!included && (
            <span className="ml-1 text-[10px] text-muted-foreground/60">· no suma</span>
          )}
        </span>
        <span
          className={cn(
            "text-xs font-semibold tabular-nums cursor-pointer",
            !included && "text-muted-foreground/50",
            included && debt
              ? (account.current_balance > 0 ? "text-income" : "text-expense")
              : included && !debt
              ? (account.current_balance < 0 ? "text-expense" : "text-income")
              : ""
          )}
          onClick={(e) => handleAccountClick(account.id, e)}
        >
          {mask(fmt(account.current_balance, account.currency))}
        </span>
        <button
          className={cn(
            "ml-1 p-1 rounded-md transition-colors shrink-0",
            included
              ? "text-muted-foreground/40 hover:text-muted-foreground"
              : "text-muted-foreground/60 hover:text-foreground"
          )}
          title={included ? "Excluir del total" : "Incluir en el total"}
          onClick={(e) => toggleIncludeInSummary(account.id, included, e)}
        >
          {included ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        </button>
      </div>
    );
  };

  const renderExpandedSection = (type: "assets" | "liabilities") => {
    const isAsset = type === "assets";

    return (
      <div className="flex justify-center">
        <div className="w-[90%] rounded-xl bg-card border border-border p-3 space-y-2">
          {allCurrencies.map(currency => {
            let accsForCurrency: typeof accounts;
            let subtotal: number;

            if (isAsset) {
              accsForCurrency = activeOnly
                .filter(a => isAssetType(a.type) && a.currency === currency)
                .sort((a, b) => a.name.localeCompare(b.name));
              subtotal = assetsByCurrency[currency] || 0;
            } else {
              accsForCurrency = activeOnly
                .filter(a => isLiability(a.type) && a.currency === currency)
                .sort((a, b) => Math.abs(b.current_balance) - Math.abs(a.current_balance));
              subtotal = liabilitiesByCurrency[currency] || 0;
            }

            if (accsForCurrency.length === 0) return null;

            const shortAccs = isAsset ? [] : accsForCurrency.filter(a => isLiabilityShort(a.type));
            const longAccs = isAsset ? [] : accsForCurrency.filter(a => isLiabilityLong(a.type));

            return (
              <div key={currency} className="space-y-1">
                <div className="flex items-center justify-between px-1 py-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {currency}
                  </span>
                  <span className={cn(
                    "text-xs font-bold tabular-nums px-2.5 py-0.5 rounded-full border",
                    isAsset
                      ? "text-income border-income/40 bg-income/10"
                      : "text-expense border-expense/40 bg-expense/10"
                  )}>
                    {!isAsset && subtotal !== 0 ? "-" : ""}
                    {mask(fmt(Math.abs(subtotal), currency))}
                  </span>
                </div>

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
      <div className="flex justify-end">
        <button
          onClick={toggle}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          title={hidden ? "Mostrar montos" : "Ocultar montos"}
        >
          {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div
          className="rounded-xl bg-income/10 border border-income/20 p-3 cursor-pointer card-interactive"
          onClick={() => setExpanded(expanded === "assets" ? null : "assets")}
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <ShieldCheck className="h-4 w-4 text-income shrink-0" />
                <p className="text-xs font-bold text-foreground">Activos</p>
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

        <div
          className="rounded-xl bg-expense/10 border border-expense/20 p-3 cursor-pointer card-interactive"
          onClick={() => setExpanded(expanded === "liabilities" ? null : "liabilities")}
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <CreditCard className="h-4 w-4 text-expense shrink-0" />
                <p className="text-xs font-bold text-foreground">Pasivos</p>
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

      {expanded && renderExpandedSection(expanded)}
    </div>
  );
}
