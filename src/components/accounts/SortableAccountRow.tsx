import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Wallet, Calendar, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Account, isLiability } from "@/hooks/useAccounts";
import { formatCurrency } from "@/lib/formatters";

interface SortableAccountRowProps {
  account: Account;
  icon: React.ElementType;
  typeLabel: string;
  mask: (v: string) => string;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
  onClick: (account: Account) => void;
  dueDay?: number | null;
  interestRate?: number | null;
}

export function SortableAccountRow({ account, icon: Icon, typeLabel, mask, onEdit, onDelete, onClick, dueDay, interestRate }: SortableAccountRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: account.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  const debt = isLiability(account.type);
  const fmt = (value: number, currency: string) => formatCurrency(value, currency);

  const hasDebtMeta = debt && ((interestRate != null && interestRate > 0) || (dueDay != null && dueDay > 0));

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-lg bg-card border border-border p-2.5 card-interactive cursor-pointer",
        isDragging && "shadow-lg ring-2 ring-primary/30"
      )}
      onClick={() => onClick(account)}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="touch-none shrink-0 p-0.5 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing self-center"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0 self-center", debt ? "bg-expense/10" : "bg-income/10")}>
        <Icon className={cn("h-4 w-4", debt ? "text-expense" : "text-income")} />
      </div>

      {/* Content area — single row for assets, stacked for debts with meta */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-1">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{account.name}</p>
            {!hasDebtMeta && (
              <p className="text-[10px] text-muted-foreground truncate">{typeLabel}</p>
            )}
          </div>
          <div className="text-right mr-0.5 shrink-0">
            <p className={cn("text-xs font-semibold tabular-nums",
              debt
                ? (account.current_balance > 0 ? "text-income" : "text-expense")
                : (account.current_balance < 0 ? "text-expense" : "text-income")
            )}>
              {mask(fmt(account.current_balance, account.currency))}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 h-6 w-6 text-muted-foreground hover:text-primary"
            onClick={(e) => { e.stopPropagation(); onEdit(account); }}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="shrink-0 h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(account); }}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
        {hasDebtMeta && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground -mt-0.5">
            <span className="truncate">{typeLabel}</span>
            {interestRate != null && interestRate > 0 && (
              <span className="flex items-center gap-0.5 shrink-0">
                <Percent className="h-2.5 w-2.5" />{interestRate}%
              </span>
            )}
            {dueDay != null && dueDay > 0 && (
              <span className="flex items-center gap-0.5 shrink-0">
                <Calendar className="h-2.5 w-2.5" />Día {dueDay}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
