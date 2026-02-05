import { Link } from "react-router-dom";
import { Plus, ArrowRightLeft, PiggyBank, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const actions = [
  {
    label: "Nuevo gasto",
    icon: Plus,
    href: "/transactions/new?type=expense",
    color: "expense" as const,
  },
  {
    label: "Nuevo ingreso",
    icon: Plus,
    href: "/transactions/new?type=income",
    color: "income" as const,
  },
  {
    label: "Transferir",
    icon: ArrowRightLeft,
    href: "/transactions/new?type=transfer",
    color: "transfer" as const,
  },
  {
    label: "Abonar a fondo",
    icon: Target,
    href: "/emergency-fund/add",
    color: "primary" as const,
  },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {actions.map((action) => (
        <Link
          key={action.label}
          to={action.href}
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl p-4 text-center transition-all card-interactive",
            action.color === "expense" && "bg-expense/5 hover:bg-expense/10",
            action.color === "income" && "bg-income/5 hover:bg-income/10",
            action.color === "transfer" && "bg-transfer/5 hover:bg-transfer/10",
            action.color === "primary" && "bg-primary/5 hover:bg-primary/10"
          )}
        >
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              action.color === "expense" && "bg-expense/10",
              action.color === "income" && "bg-income/10",
              action.color === "transfer" && "bg-transfer/10",
              action.color === "primary" && "bg-primary/10"
            )}
          >
            <action.icon
              className={cn(
                "h-5 w-5",
                action.color === "expense" && "text-expense",
                action.color === "income" && "text-income",
                action.color === "transfer" && "text-transfer",
                action.color === "primary" && "text-primary"
              )}
            />
          </div>
          <span className="text-xs font-medium text-foreground">
            {action.label}
          </span>
        </Link>
      ))}
    </div>
  );
}
