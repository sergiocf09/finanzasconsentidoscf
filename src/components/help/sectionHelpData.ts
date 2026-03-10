import type { SectionHelpContent } from "./SectionHelp";

export const helpData: Record<string, SectionHelpContent> = {
  dashboard: {
    title: "Tu Panel Principal",
    whatIsThis: "Es tu vista rápida de cómo va tu dinero este mes: cuánto entra, cuánto sale y cuánto tienes.",
    actions: [
      "Ver tu balance total al instante",
      "Revisar tus ingresos y gastos del mes",
      "Consultar tus próximos pagos pendientes",
      "Acceder al tipo de cambio del día",
    ],
    tip: "Revísalo cada mañana — 30 segundos bastan para saber cómo vas.",
    doINeedIt: "Es tu punto de partida. Todo empieza aquí.",
  },
  accounts: {
    title: "Tus Cuentas",
    whatIsThis: "Aquí viven todas tus cuentas: bancos, efectivo, tarjetas, inversiones. Es tu mapa de dónde está tu dinero.",
    actions: [
      "Agregar cuentas en diferentes monedas",
      "Ver el saldo actual de cada cuenta",
      "Editar o desactivar cuentas que ya no uses",
      "Ver el desglose de activos y pasivos",
    ],
    tip: "Empieza con tus 2-3 cuentas principales. Puedes agregar más después.",
    doINeedIt: "Es esencial — sin cuentas no puedes registrar movimientos.",
  },
  transactions: {
    title: "Tus Movimientos",
    whatIsThis: "El registro de todo lo que entra y sale de tus cuentas. Es como tu estado de cuenta personal.",
    actions: [
      "Registrar ingresos y gastos rápidamente",
      "Buscar y filtrar por fecha, tipo o categoría",
      "Ver el detalle de cada movimiento",
      "Convertir un gasto en pago recurrente",
    ],
    tip: "Registra tus gastos en el momento — es más fácil que recordarlos después.",
    doINeedIt: "Es el corazón de la app. Mientras más registres, mejores serán tus insights.",
  },
  budgets: {
    title: "Tus Presupuestos",
    whatIsThis: "Define cuánto quieres gastar en cada categoría. Te avisa cuando te acercas al límite.",
    actions: [
      "Crear presupuestos por categoría y mes",
      "Ver cuánto llevas gastado vs lo planeado",
      "Recibir alertas cuando estés cerca del límite",
      "Navegar entre meses para comparar",
    ],
    tip: "No necesitas presupuestar todo — empieza con las 3 categorías donde más gastas.",
    doINeedIt: "Muy recomendable si quieres controlar tus gastos sin sorpresas a fin de mes.",
  },
  debts: {
    title: "Tus Deudas",
    whatIsThis: "Un panorama claro de todo lo que debes: tarjetas, créditos, préstamos. Te ayuda a planear cómo salir de ellas.",
    actions: [
      "Registrar todas tus deudas con tasas y plazos",
      "Ver sugerencias de pago (bola de nieve o avalancha)",
      "Consultar tu relación deuda/ingreso",
      "Vincular deudas a cuentas para seguimiento automático",
    ],
    tip: "Conocer exactamente cuánto debes es el primer paso para dejar de deber.",
    doINeedIt: "Puedes usar la app sin esto, pero te da mayor control sobre tus deudas.",
  },
  emergencyFund: {
    title: "Tu Fondo de Emergencia",
    whatIsThis: "Tu colchón financiero para imprevistos. Aquí defines cuánto necesitas y llevas el avance.",
    actions: [
      "Definir tu meta de fondo de emergencia",
      "Registrar aportaciones mensuales",
      "Ver tu progreso hacia la meta",
    ],
    tip: "La regla general es tener 3-6 meses de gastos. Empieza con 1 mes y ve creciendo.",
    doINeedIt: "Es complementario pero muy valioso — te da tranquilidad ante lo inesperado.",
  },
  financialDashboard: {
    title: "Inteligencia Financiera",
    whatIsThis: "Un análisis profundo de tus finanzas: distribución de gastos, señales de alerta y recomendaciones personalizadas.",
    actions: [
      "Ver en qué etapa financiera estás",
      "Analizar la distribución de tus gastos por bloques",
      "Recibir señales y recomendaciones automáticas",
      "Comparar categorías mes a mes",
    ],
    tip: "Revísalo una vez al mes para identificar patrones y ajustar tu estrategia.",
    doINeedIt: "Es tu coach financiero automático. Más útil cuando ya tienes unas semanas de datos.",
  },
  reports: {
    title: "Reportes",
    whatIsThis: "Resúmenes visuales de tus finanzas por período. Gráficas y desgloses para entender tus hábitos.",
    actions: [
      "Ver resumen de ingresos, gastos y balance",
      "Analizar gastos por categoría con gráficos",
      "Comparar períodos para detectar tendencias",
    ],
    tip: "Compara el mes actual con el anterior para ver si estás mejorando.",
    doINeedIt: "Complementario — te ayuda a ver el panorama grande de tus finanzas.",
  },
  recurringPayments: {
    title: "Pagos Recurrentes",
    whatIsThis: "Tus gastos fijos que se repiten: suscripciones, servicios, colegiaturas. Te recuerda cuándo toca pagar.",
    actions: [
      "Registrar pagos que se repiten automáticamente",
      "Ver el calendario de próximos pagos",
      "Pausar o cancelar pagos que ya no necesitas",
      "Aceptar sugerencias basadas en tus gastos",
    ],
    tip: "Revisa tus suscripciones cada 3 meses — a veces pagamos cosas que ya no usamos.",
    doINeedIt: "Muy útil si tienes varios pagos fijos. Te evita olvidos y multas.",
  },
};
