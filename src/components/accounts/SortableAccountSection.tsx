import { useCallback, useEffect, useState } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { Account } from "@/hooks/useAccounts";
import { SortableAccountRow } from "./SortableAccountRow";
import { Wallet, Building2, PiggyBank, TrendingUp, CreditCard, HandCoins, Home, Car, User, Landmark } from "lucide-react";

const typeIcons: Record<string, React.ElementType> = {
  cash: Wallet, bank: Building2, savings: PiggyBank, investment: TrendingUp,
  credit_card: CreditCard, payable: HandCoins, mortgage: Home, auto_loan: Car,
  personal_loan: User, caucion_bursatil: Landmark,
};

const typeLabels: Record<string, string> = {
  cash: "Efectivo", bank: "Cuenta bancaria", savings: "Ahorro", investment: "Inversión",
  credit_card: "Tarjeta de crédito", payable: "Cuenta por pagar", mortgage: "Crédito hipotecario",
  auto_loan: "Crédito automotriz", personal_loan: "Crédito personal", caucion_bursatil: "Caución bursátil",
};

export interface AccountMetadata {
  dueDay?: number | null;
  interestRate?: number | null;
}

interface SortableAccountSectionProps {
  sectionKey: string;
  accounts: Account[];
  mask: (v: string) => string;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
  onClick: (account: Account) => void;
  metadata?: Record<string, AccountMetadata>;
}

function getStoredOrder(key: string): string[] | null {
  try {
    const raw = localStorage.getItem(`account-order-${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setStoredOrder(key: string, ids: string[]) {
  try { localStorage.setItem(`account-order-${key}`, JSON.stringify(ids)); } catch { /* noop */ }
}

export function SortableAccountSection({ sectionKey, accounts, mask, onEdit, onDelete, onClick, metadata }: SortableAccountSectionProps) {
  const [orderedAccounts, setOrderedAccounts] = useState<Account[]>(accounts);

  useEffect(() => {
    const stored = getStoredOrder(sectionKey);
    if (stored && stored.length > 0) {
      const accountMap = new Map(accounts.map(a => [a.id, a]));
      const ordered: Account[] = [];
      for (const id of stored) {
        const acc = accountMap.get(id);
        if (acc) { ordered.push(acc); accountMap.delete(id); }
      }
      accountMap.forEach(acc => ordered.push(acc));
      setOrderedAccounts(ordered);
    } else {
      setOrderedAccounts(accounts);
    }
  }, [accounts, sectionKey]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrderedAccounts(prev => {
      const oldIndex = prev.findIndex(a => a.id === active.id);
      const newIndex = prev.findIndex(a => a.id === over.id);
      const next = arrayMove(prev, oldIndex, newIndex);
      setStoredOrder(sectionKey, next.map(a => a.id));
      return next;
    });
  }, [sectionKey]);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedAccounts.map(a => a.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">
          {orderedAccounts.map(account => {
            const meta = metadata?.[account.id];
            return (
              <SortableAccountRow
                key={account.id}
                account={account}
                icon={typeIcons[account.type] || Wallet}
                typeLabel={typeLabels[account.type] || account.type}
                mask={mask}
                onEdit={onEdit}
                onDelete={onDelete}
                onClick={onClick}
                dueDay={meta?.dueDay}
                interestRate={meta?.interestRate}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
