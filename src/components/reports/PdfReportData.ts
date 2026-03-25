import { Account } from "@/hooks/useAccounts";
import { SavingsGoal } from "@/hooks/useSavingsGoals";
import { NonFinancialAsset } from "@/hooks/useNonFinancialAssets";

export interface PdfTransaction {
  id: string;
  transaction_date: string;
  type: string;
  description: string | null;
  category_id: string | null;
  account_id: string;
  amount: number;
  amount_in_base: number | null;
  currency: string;
}

export interface PdfBlockSummary {
  label: string;
  amount: number;
  percent: number;
}

export interface PdfTopCategory {
  name: string;
  amount: number;
  pct: number;
}

export interface PdfReportData {
  periodTitle: string;
  periodLabel: string;
  generatedAt: string;
  totals: { income: number; expense: number };
  blockSummaries: PdfBlockSummary[];
  topCategories: PdfTopCategory[];
  activeAssets: Account[];
  activeLiabs: Account[];
  nfAssets: NonFinancialAsset[];
  convertToMXN: (value: number, currency: string) => number;
  activeGoals: SavingsGoal[];
  transactions: PdfTransaction[];
  categoryMap: Record<string, string>;
  accountMap: Record<string, string>;
}
