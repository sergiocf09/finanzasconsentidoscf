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
  Settings,
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
    description: "Tu punto de partida cada día — un vistazo honesto y claro de cómo están tus finanzas en este momento",
    actions: [
      "Ver el flujo de ingresos y gastos del mes en curso",
      "Revisar cómo se distribuyen tus recursos entre activos y pasivos",
      "Detectar señales de alerta antes de que se conviertan en problema",
      "Registrar un ingreso, gasto o transferencia con el botón + debajo del resumen del periodo",
      "Usar el micrófono 🎙️ flotante para registrar cualquier movimiento con tu voz desde cualquier pantalla"
    ],
    tip: "Revisarlo cada lunes te toma menos de dos minutos y te da claridad para toda la semana — esa claridad es lo que convierte la información en tranquilidad",
    needed: "Sí, es tu punto de partida — todo lo demás se alimenta desde aquí"
  },
  "/transactions": {
    title: "Movimientos",
    description: "El registro de todo lo que entra y sale — porque lo que no se registra no se puede entender ni mejorar",
    actions: [
      "Registrar ingresos, gastos y transferencias manualmente o por voz",
      "Filtrar por periodo, tipo de movimiento o cuenta específica",
      "Buscar cualquier movimiento por descripción o categoría",
      "Ver los totales del periodo para saber exactamente cómo vas",
      "Consultar el detalle completo de cualquier movimiento"
    ],
    tip: "Registrar el mismo día que ocurre el gasto es el hábito más poderoso que puedes desarrollar — no necesitas ser perfecto, solo consistente",
    needed: "Esencial — es la base de todo. Sin movimientos registrados, el resto de la app no tiene información con qué trabajar"
  },
  "/accounts": {
    title: "Cuentas",
    description: "Todas tus cuentas en un solo lugar — para que siempre sepas con qué cuentas y no haya sorpresas",
    actions: [
      "Agregar cuentas bancarias, tarjetas de crédito, débito o efectivo",
      "Ver el saldo de cada cuenta actualizado con cada movimiento que registras",
      "Ajustar el balance manualmente cuando necesites reflejar tu saldo real, aunque no hayas registrado todos los movimientos",
      "Consultar el historial de movimientos de una cuenta específica",
      "Ocultar montos si estás en un lugar público",
      "Archivar cuentas que ya no usas sin perder su historial"
    ],
    tip: "Tener todas tus cuentas aquí — incluyendo las de crédito — te da la imagen completa de tu situación real. La claridad incómoda es mejor que la comodidad ciega",
    needed: "Esencial — cada movimiento que registras necesita una cuenta de origen. Sin ellas, nada tiene contexto"
  },
  "/budgets": {
    title: "Presupuestos",
    description: "Decide con intención a dónde va tu dinero antes de que llegue — eso es lo que convierte el ingreso en tranquilidad",
    actions: [
      "🔵 Estabilidad — define cuánto necesitas para cubrir lo indispensable cada mes, ese es tu número de paz",
      "🟡 Calidad de vida — ponle un límite consciente a los gastos variables para disfrutarlos sin culpa y sin sorpresas",
      "🟢 Construcción — decide cuánto destinarás a construir tu patrimonio cada mes, trátalo con la misma seriedad que cualquier gasto fijo",
      "Ver en tiempo real cuánto llevas vs tu límite en cada categoría",
      "Recibir alertas que te ayudan a corregir el rumbo a tiempo, sin culpa y con claridad"
    ],
    tip: "Presupuestar los 3 bloques juntos te da algo que va más allá de los números: te da paz. Sabes que lo esencial está cubierto, que te permites disfrutar con conciencia, y que estás construyendo algo tuyo — eso es Finanzas con Sentido",
    needed: "Muy recomendado — es donde la intención se convierte en acción concreta"
  },
  "/categories": {
    title: "Categorías",
    description: "El lugar donde le das nombre y orden a tu dinero — porque cuando sabes a dónde va cada peso, recuperas la calma",
    actions: [
      "🔵 Estabilidad — tus gastos fijos e indispensables, el piso que te da seguridad: renta, servicios, alimentación básica",
      "🟡 Calidad de vida — gastos variables que hacen tu día a día más disfrutable y que puedes ajustar con conciencia cuando lo necesitas",
      "🟢 Construcción — lo que decides destinar a crecer: fondo de emergencia, ahorro, inversiones o metas que te importan",
      "💰 Ingresos — clasifica tus fuentes de ingreso para entender de dónde viene tu dinero y qué tan diversificado está",
      "Crear y personalizar categorías dentro de cada bloque para que reflejen tu vida real, no una plantilla genérica"
    ],
    tip: "Clasificar bien desde el inicio es lo que hace que todo lo demás funcione — cuando cada movimiento está en su lugar, tu diagnóstico financiero es honesto y tus decisiones se vuelven más fáciles",
    needed: "Esencial — es la base sobre la que se construye todo el análisis de la app"
  },
  "/debts": {
    title: "Deudas",
    description: "Enfrenta tus deudas con claridad y sin drama — saber exactamente lo que debes es el primer paso para dejar de deber",
    actions: [
      "Registrar cada deuda con su saldo, tasa de interés y pago mínimo",
      "Ver tu DTI (relación deuda-ingreso) para entender qué tan pesada es tu carga real",
      "Proyectar cuándo quedarás libre si sigues tu plan actual",
      "Identificar qué deuda atacar primero para avanzar más rápido",
      "Monitorear tu progreso mes a mes"
    ],
    tip: "Una deuda registrada y entendida ya está medio resuelta — el estrés financiero viene más de lo que no vemos que de lo que sí vemos",
    needed: "Importante si tienes créditos activos — ignorarlos no los hace desaparecer, entenderlos sí te da control"
  },
  "/construction": {
    title: "Construcción",
    description: "El espacio donde tu dinero empieza a trabajar para tu futuro — metas concretas, avances visibles, patrimonio que crece",
    actions: [
      "Crear metas de ahorro: fondo de emergencia, retiro o cualquier meta que te importe",
      "Registrar abonos y ver cómo avanza cada meta",
      "Saber cuántos meses de gastos tienes cubiertos con tu fondo de emergencia",
      "Definir una fecha objetivo y ver si vas en camino",
      "Celebrar cada avance — construir patrimonio se hace paso a paso"
    ],
    tip: "El fondo de emergencia no es un lujo, es la base que te permite tomar mejores decisiones en todo lo demás — cuando tienes un colchón, dejas de tomar decisiones desde el miedo",
    needed: "Prioritario en cuanto tengas estabilidad en tus gastos fijos — es lo que transforma el control financiero en libertad real"
  },
  "/financial-dashboard": {
    title: "Dashboard Financiero",
    description: "Tu diagnóstico financiero honesto — no para juzgarte, sino para que sepas exactamente dónde estás y hacia dónde puedes ir",
    actions: [
      "Ver tu etapa financiera actual: Estabilizar, Equilibrar o Construir",
      "Revisar señales positivas de lo que ya estás haciendo bien",
      "Identificar puntos de atención antes de que se vuelvan urgentes",
      "Entender cómo se distribuye tu gasto real en los 3 bloques",
      "Recibir recomendaciones personalizadas basadas en tus números reales"
    ],
    tip: "Tu etapa no es un juicio — es un punto de partida. Cada persona está donde está, y desde ahí se avanza. Revisarlo mensualmente te permite ver la evolución que el día a día no deja ver",
    needed: "Complementario pero muy poderoso — es el espejo que te muestra el panorama completo cuando ya tienes movimientos registrados"
  },
  "/recurring": {
    title: "Pagos Recurrentes",
    description: "Tus compromisos fijos automatizados — para que no dependas de tu memoria y nada se escape sin querer",
    actions: [
      "Registrar pagos que se repiten: suscripciones, servicios, cuotas, membresías",
      "Ver qué pagos vienen próximamente para anticiparte",
      "Activar o pausar pagos cuando cambia tu situación",
      "Editar montos cuando suben o cambian las condiciones",
      "Evitar cargos olvidados que descuadran tu presupuesto"
    ],
    tip: "Lo que no ves también cuenta — muchas personas se sorprenden al sumar todas sus suscripciones activas. Tenerlas aquí te da visibilidad total de tus compromisos fijos",
    needed: "Muy útil si tienes 3 o más pagos fijos al mes — te ahorra sorpresas y te da control sin esfuerzo"
  },
  "/reports": {
    title: "Exportar reporte",
    description: "Descarga un resumen de tu mes en PDF o un listado completo de movimientos en Excel.",
    actions: [
      "El PDF incluye tus 3 bloques, presupuestos y top de categorías",
      "El Excel contiene todos los movimientos del periodo seleccionado",
    ],
    tip: "Exportar tu reporte mensual es una buena forma de archivar tu progreso y compartirlo con quien necesites.",
    needed: "Útil para revisar con tu pareja, contador o simplemente para archivar tu historial.",
  },
  "/exchange-rate": {
    title: "Tipo de Cambio",
    description: "La referencia que permite que todo lo que entra y sale en otra moneda se entienda siempre en pesos",
    actions: [
      "Ver los tipos de cambio vigentes para USD, EUR y otras divisas",
      "Actualizar manualmente si necesitas usar una tasa específica",
      "Elegir qué monedas quieres ver en tu pantalla de inicio",
      "Garantizar que los totales de ingresos y gastos siempre estén valorizados en tu moneda base"
    ],
    tip: "Si tienes ingresos o gastos en dólares, mantener el tipo de cambio actualizado es lo que hace que tus totales en pesos sean reales y confiables",
    needed: "Esencial si manejas más de una moneda — sin esto, las cifras en pantalla no reflejarían tu realidad financiera completa"
  },
  "/library": {
    title: "Mi Biblioteca",
    description: "Recursos para que el conocimiento financiero te acompañe — porque entender el dinero es parte de la tranquilidad que buscamos",
    actions: [
      "Explorar guías y materiales del programa Finanzas con Sentido",
      "Leer sobre cómo ordenar, presupuestar y construir patrimonio",
      "Profundizar en los conceptos que más te interesan a tu propio ritmo",
      "Encontrar respuestas cuando algo de la app o del método no queda claro"
    ],
    tip: "No tienes que leerlo todo de golpe — un concepto bien entendido y aplicado vale más que diez leídos y olvidados",
    needed: "Complementario — úsalo cuando sientas que quieres entender más el porqué detrás de lo que estás haciendo"
  },
  "/settings": {
    title: "Configuración",
    description: "Personaliza la app para que se adapte a ti — no al revés",
    actions: [
      "Cambiar tu moneda base y preferencias de visualización",
      "Gestionar y personalizar tus categorías de ingresos y gastos",
      "Configurar notificaciones y alertas de presupuesto",
      "Archivar cuentas o categorías que ya no uses sin perder historial",
      "Gestionar tu perfil y datos de la cuenta"
    ],
    tip: "Dedica 10 minutos al inicio a configurar bien las categorías y tu moneda base — esa inversión de tiempo hace que todo lo demás fluya solo",
    needed: "Visítala al inicio para personalizar y cuando algo no encaje con tu realidad — la app debe reflejar tu vida, no una vida genérica"
  }
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
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-header-bg border-b border-white/10">
        <div className="flex h-full items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
              <Leaf className="h-4 w-4 text-gold" />
            </div>
            <span className="font-heading font-semibold text-header-foreground">
              Finanzas con Sentido
            </span>
          </div>
          {!isAuthPage && helpContent && (
            <div className="flex items-center gap-3">
              <Link to="/settings" onClick={() => {}}>
                <Settings className="h-5 w-5 text-header-foreground/70 hover:text-header-foreground transition-colors" />
              </Link>
              <button
                onClick={() => setHelpOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-header-foreground/70 hover:text-header-foreground hover:bg-white/10 transition-colors"
                aria-label="Ayuda"
              >
                <CircleHelp className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Help Sheet */}
      <Sheet open={helpOpen} onOpenChange={setHelpOpen}>
        <SheetContent side="top" className="mt-14 rounded-b-2xl rounded-t-none border-t-0 max-h-[82vh] overflow-y-auto shadow-lg">
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
            <SheetContent side="left" className="w-72 p-0 [&>button]:top-3 [&>button]:right-3 [&>button]:z-50 [&>button]:opacity-100 [&>button]:h-8 [&>button]:w-8 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:bg-muted [&>button]:text-foreground [&>button]:hover:bg-muted-foreground/20 [&>button>svg]:h-5 [&>button>svg]:w-5">
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
