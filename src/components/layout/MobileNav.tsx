import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Receipt,
  PiggyBank,
  Wallet,
  MoreHorizontal,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";
import { Leaf } from "lucide-react";

const mobileNavItems = [
  { name: "Inicio", href: "/", icon: LayoutDashboard },
  { name: "Movimientos", href: "/transactions", icon: Receipt },
  { name: "Presupuestos", href: "/budgets", icon: PiggyBank },
  { name: "Cuentas", href: "/accounts", icon: Wallet },
];

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const location = useLocation();

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex h-full items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Leaf className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-heading font-semibold text-foreground">
              Finanzas con Sentido
            </span>
          </div>
        </div>
      </header>

      {/* Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-sm border-t border-border">
        <div className="flex h-16 items-center justify-around px-2">
          {mobileNavItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}

          {/* More Menu */}
          <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                <MoreHorizontal className="h-5 w-5" />
                <span>Más</span>
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Menú de navegación</SheetTitle>
              </SheetHeader>
              <Sidebar className="flex relative w-full border-0" onNavigate={() => onOpenChange(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {/* Spacer for fixed header */}
      <div className="lg:hidden h-14" />
    </>
  );
}
