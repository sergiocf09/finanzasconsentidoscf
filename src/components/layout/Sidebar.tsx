import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Receipt,
  PiggyBank,
  Wallet,
  CreditCard,
  Repeat,
  Target,
  BookOpen,
  Leaf,
  Tag,
  Gauge,
  ArrowRightLeft,
} from "lucide-react";

const navigation = [
  { name: "Inicio", href: "/", icon: LayoutDashboard },
  { name: "Movimientos", href: "/transactions", icon: Receipt },
  { name: "Cuentas", href: "/accounts", icon: Wallet },
  { name: "Presupuestos", href: "/budgets", icon: PiggyBank },
  { name: "Deudas", href: "/debts", icon: CreditCard },
  { name: "Categorías", href: "/categories", icon: Tag },
  { name: "Pagos Recurrentes", href: "/recurring", icon: Repeat },
  { name: "Construcción", href: "/construction", icon: Target },
  { name: "Dashboard", href: "/financial-dashboard", icon: Gauge },
  { name: "Tipo de cambio", href: "/exchange-rate", icon: ArrowRightLeft },
  { name: "Mi Biblioteca", href: "/library", icon: BookOpen },
];

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const location = useLocation();

  const handleClick = () => {
    onNavigate?.();
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-72 flex-col bg-sidebar border-r border-sidebar-border",
        className
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
          <Leaf className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="font-heading text-lg font-semibold text-sidebar-foreground">
            Finanzas
          </span>
          <span className="text-xs text-muted-foreground -mt-0.5">
            con Sentido™
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <li key={item.name}>
                <Link
                  to={item.href}
                  onClick={handleClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

  );
}
