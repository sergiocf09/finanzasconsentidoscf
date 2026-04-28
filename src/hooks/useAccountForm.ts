import { useAccounts, isLiability } from "@/hooks/useAccounts";
import { useDebts } from "@/hooks/useDebts";

export interface AccountFormSubmitData {
  name?: string;
  type?: string;
  currency?: string;
  initial_balance?: number;
  creditor?: string;
  interest_rate?: number;
  minimum_payment?: number;
  monthly_commitment?: number;
  due_day?: number;
  debt_category?: string;
}

const debtTypeMap: Record<string, string> = {
  credit_card: "credit_card",
  mortgage: "mortgage",
  auto_loan: "car_loan",
  personal_loan: "personal_loan",
  caucion_bursatil: "other",
  payable: "other",
};

export function useAccountForm() {
  const { createAccount } = useAccounts();
  const { createDebtForAccount } = useDebts({ enabled: false });

  const submit = async (data: AccountFormSubmitData) => {
    const balance = isLiability(data.type) && data.initial_balance > 0
      ? -Math.abs(data.initial_balance)
      : data.initial_balance;

    const newAccount = await createAccount.mutateAsync({
      name: data.name,
      type: data.type as any,
      currency: data.currency,
      initial_balance: balance,
    });

    if (isLiability(data.type) && newAccount) {
      await createDebtForAccount.mutateAsync({
        account_id: newAccount.id,
        name: data.name,
        type: (debtTypeMap[data.type] || "other") as any,
        creditor: data.creditor || null,
        original_amount: Math.abs(data.initial_balance) || 0,
        current_balance: Math.abs(data.initial_balance) || 0,
        interest_rate: data.interest_rate || 0,
        minimum_payment: data.minimum_payment || 0,
        monthly_commitment: data.monthly_commitment || 0,
        due_day: data.due_day || null,
        debt_category: data.debt_category || "current",
        currency: data.currency,
      });
    }
  };

  return {
    submit,
    isPending: createAccount.isPending || createDebtForAccount.isPending,
  };
}
