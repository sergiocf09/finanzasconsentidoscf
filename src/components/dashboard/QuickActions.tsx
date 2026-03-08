import { useState } from "react";
import { Plus, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { TransferForm } from "@/components/transfers/TransferForm";

export function QuickActions() {
  const [formOpen, setFormOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [formType, setFormType] = useState<"income" | "expense">("expense");

  const openForm = (type: "income" | "expense") => {
    setFormType(type);
    setFormOpen(true);
  };

  const actions = [
    {
      label: "Nuevo ingreso",
      icon: Plus,
      onClick: () => openForm("income"),
      color: "income" as const,
    },
    {
      label: "Nuevo gasto",
      icon: Plus,
      onClick: () => openForm("expense"),
      color: "expense" as const,
    },
    {
      label: "Transferir",
      icon: ArrowRightLeft,
      onClick: () => setTransferOpen(true),
      color: "transfer" as const,
    },
  ];

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-xl p-3 text-center transition-all card-interactive",
              action.color === "expense" && "bg-expense/5 hover:bg-expense/10",
              action.color === "income" && "bg-income/5 hover:bg-income/10",
              action.color === "transfer" && "bg-transfer/5 hover:bg-transfer/10"
            )}
          >
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl",
                action.color === "expense" && "bg-expense/10",
                action.color === "income" && "bg-income/10",
                action.color === "transfer" && "bg-transfer/10"
              )}
            >
              <action.icon
                className={cn(
                  "h-5 w-5",
                  action.color === "expense" && "text-expense",
                  action.color === "income" && "text-income",
                  action.color === "transfer" && "text-transfer"
                )}
              />
            </div>
            <span className="text-xs font-medium text-foreground">{action.label}</span>
          </button>
        ))}
      </div>

      <TransactionForm open={formOpen} onOpenChange={setFormOpen} defaultType={formType} />
      <TransferForm open={transferOpen} onOpenChange={setTransferOpen} />
    </>
  );
}
