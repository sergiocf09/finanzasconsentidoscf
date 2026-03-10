import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  PiggyBank,
  CreditCard,
  MoreHorizontal,
  CircleHelp,
  Leaf,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";

const mobileNavItems = [
  { name: "Inicio", href: "/", icon: LayoutDashboard },
  { name: "Movimientos", href: "/transactions", icon: Receipt },
  { name: "Cuentas", href: "/accounts", icon: Wallet },
  { name: "Presupuestos", href: "/budgets", icon: PiggyBank },
  { name: "Deudas", href: "/debts", icon: CreditCard },
];

interface HelpEntry {
  title: string;
  description: string;
  actions: string[];
  tip: string;
  needed: string;
}

const HELP_CONTENT: Record<string, HelpEntry> = {
  "/": {
    title: "Inicio",
    description: "Tu panorama financiero completo de un vistazo",
    actions: ["Ver el flujo de ingresos y gastos del mes", "Revisar tus 3 bloques financieros", "Detectar señales de alerta tempranas", "Ver tus cuentas activas y saldos"],
    tip: "Revísalo cada lunes para arrancar la semana con claridad",
    needed: "Sí, es tu punto de partida diario",
  },
  "/transactions": {
    title: "Movimientos",
    description: "Registro de todo lo que entra y sale de tus cuentas",
    actions: ["Registrar ingresos, gastos y transferencias", "Filtrar por periodo, tipo o cuenta", "Buscar un movimiento específico", "Ver totales del periodo seleccionado"],
    tip: "Registra el mismo día para no perder el hilo",
    needed: "Esencial — sin esto nada funciona",
  },
  "/accounts": {
    title: "Cuentas",
    description: "Todas tus cuentas bancarias, tarjetas y efectivo en un lugar",
    actions: ["Agregar y editar cuentas", "Ver el saldo actual de cada cuenta", "Consultar el historial por cuenta", "Archivar cuentas que ya no usas"],
    tip: "Mantén solo las cuentas que usas activamente",
    needed: "Esencial para que los movimientos tengan contexto",
  },
  "/budgets": {
    title: "Presupuestos",
    description: "Establece límites de gasto por categoría y monitorea si los cumples",
    actions: ["Crear presupuestos por categoría", "Ver cuánto llevas vs tu límite", "Recibir alertas cuando te acercas al tope", "Ajustar montos cuando cambia tu situación"],
    tip: "Empieza con las 3 categorías donde más gastas",
    needed: "Muy recomendado si quieres controlar gastos",
  },
  "/debts": {
    title: "Deudas",
    description: "Monitorea lo que debes y proyecta cuándo quedarás libre",
    actions: ["Registrar deudas con tasa y plazo", "Ver tu DTI (deuda vs ingreso)", "Proyectar fecha de liquidación", "Priorizar qué deuda atacar primero"],
    tip: "Una deuda bien registrada ya está medio pagada",
    needed: "Importante si tienes créditos activos",
  },
  "/construction": {
    title: "Construcción Patrimonial",
    description: "Construye metas de largo plazo: fondo de emergencia, inversiones y patrimonio",
    actions: ["Crear metas de ahorro o fondo de emergencia", "Registrar avances hacia cada meta", "Ver cuántos meses de gastos tienes cubiertos", "Definir cuánto aportar cada mes"],
    tip: "3 meses de gastos es el mínimo recomendado antes de invertir",
    needed: "Prioritario cuando ya controlas tus gastos del mes",
  },
  "/financial-dashboard": {
    title: "Dashboard Financiero",
    description: "Diagnóstico profundo de tu salud financiera con indicadores reales",
    actions: ["Ver tu etapa financiera actual", "Revisar señales positivas y de alerta", "Entender tus 3 bloques de distribución del dinero", "Recibir recomendaciones personalizadas"],
    tip: "Revísalo mensualmente para ver tu evolución real",
    needed: "Complementario pero muy revelador — úsalo como espejo",
  },
  "/recurring": {
    title: "Pagos Recurrentes",
    description: "Automatiza el registro de pagos fijos que se repiten",
    actions: ["Crear pagos con frecuencia definida", "Ver próximas ejecuciones", "Activar o pausar pagos cuando cambian", "Editar montos cuando suben"],
    tip: "Agrega todas tus suscripciones y servicios fijos para no olvidarlos",
    needed: "Muy útil si tienes 3 o más pagos fijos al mes",
  },
  "/settings": {
    title: "Configuración",
    description: "Personaliza la app según tus preferencias y perfil",
    actions: ["Cambiar moneda base", "Gestionar categorías propias", "Ajustar notificaciones", "Archivar cuentas y categorías inactivas"],
    tip: "Revisa las categorías para que coincidan con tu vida real",
    needed: "Visítala al inicio y cuando algo no encaje",
  },
};

function getHelpForPath(pathname: string): HelpEntry | null {
  // Exact match first
  if (HELP_CONTENT[pathname]) return HELP_CONTENT[pathname];
  // Check prefixes for sub-routes like /accounts/:id
  for (const key of Object.keys(HELP_CONTENT)) {
    if (pathname.startsWith(key) && key !== "/") return HELP_CONTENT[key];
  }
  return null;
}

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const location = useLocation();
  const [helpOpen, setHelpOpen] = useState(false);

  const helpContent = getHelpForPath(location.pathname);
  const isAuthPage = location.pathname.startsWith("/auth") || location.pathname.startsWith("/reset-password");

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
          {!isAuthPage && helpContent && (
            <button
              onClick={() => setHelpOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Ayuda"
            >
              <CircleHelp className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>

      {/* Help Sheet */}
      <Sheet open={helpOpen} onOpenChange={setHelpOpen}>
        <SheetContent side="bottom" className="max-h-[72vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="pb-3">
            <SheetTitle className="text-base font-heading flex items-center gap-2">
              <CircleHelp className="h-4 w-4 text-primary" />
              {helpContent?.title ?? "Ayuda"}
            </SheetTitle>
          </SheetHeader>
          {helpContent ? (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Qué es</p>
                <p className="text-sm text-foreground">{helpContent.description}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Qué puedes hacer</p>
                <ul className="space-y-1">
                  {helpContent.actions.map((action, i) => (
                    <li key={i} className="text-sm text-foreground flex gap-2">
                      <span className="text-primary shrink-0">·</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Tip 💡</p>
                <p className="text-sm text-foreground italic">{helpContent.tip}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">¿Lo necesito?</p>
                <p className="text-sm text-foreground">{helpContent.needed}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Explora esta sección para descubrir sus funciones.</p>
          )}
        </SheetContent>
      </Sheet>

      {/* Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-sm border-t border-border safe-area-bottom">
        <div className="flex h-16 items-center justify-around px-1">
          {mobileNavItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 min-w-0 flex-1 py-2 text-[10px] leading-tight font-medium transition-colors text-center",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="break-words line-clamp-2">{item.name}</span>
              </Link>
            );
          })}

          {/* More Menu */}
          <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center gap-0.5 min-w-0 flex-1 py-2 text-[10px] leading-tight font-medium text-muted-foreground hover:text-foreground transition-colors text-center">
                <MoreHorizontal className="h-5 w-5 shrink-0" />
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
