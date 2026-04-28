export interface DueItem {
  id: string;
  name: string;
  day: number;
  nextDate: Date;
  daysLeft: number;
  amount: number;
  currency: string;
  type: "debt" | "goal";
  accountId: string | null;
}

export type TimeFilter = "7" | "15" | "30";

export const filterLabels: Record<TimeFilter, string> = {
  "7": "7 días",
  "15": "15 días",
  "30": "30 días",
};

/**
 * Returns this month's occurrence date regardless of whether it has passed.
 * This ensures overdue items remain visible until the user confirms payment.
 * Items with daysLeft < 0 are shown as "Vencido".
 */
export function getNextOccurrence(day: number, today: Date): Date {
  const safeDay = Math.max(1, Math.min(31, Math.round(day)));
  const y = today.getFullYear();
  const m = today.getMonth();

  const daysInThisMonth = new Date(y, m + 1, 0).getDate();
  const clampedDay = Math.min(safeDay, daysInThisMonth);
  const thisMonth = new Date(y, m, clampedDay);
  thisMonth.setHours(0, 0, 0, 0);

  return thisMonth;
}

export function getMaxDays(filter: TimeFilter, _today: Date): number {
  if (filter === "7") return 7;
  if (filter === "15") return 15;
  return 30;
}
