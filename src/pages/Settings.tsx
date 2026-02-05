import { User, Bell, DollarSign, Palette, Shield, HelpCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const settingSections = [
  {
    title: "Cuenta",
    icon: User,
    items: [
      { label: "Nombre", value: "Usuario" },
      { label: "Email", value: "usuario@email.com" },
    ],
  },
  {
    title: "Moneda",
    icon: DollarSign,
    items: [
      { label: "Moneda principal", value: "MXN - Peso mexicano" },
      { label: "Formato de números", value: "1,234.56" },
    ],
  },
];

export default function Settings() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">
          Configuración
        </h1>
        <p className="text-muted-foreground">
          Personaliza tu experiencia en la app
        </p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {settingSections.map((section) => (
          <div
            key={section.title}
            className="rounded-2xl bg-card border border-border overflow-hidden"
          >
            <div className="flex items-center gap-3 p-4 border-b border-border">
              <section.icon className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-medium text-foreground">{section.title}</h2>
            </div>
            <div className="divide-y divide-border">
              {section.items.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between p-4"
                >
                  <span className="text-sm text-foreground">{item.label}</span>
                  <span className="text-sm text-muted-foreground">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Notifications */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-medium text-foreground">Notificaciones</h2>
          </div>
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between p-4">
              <div>
                <Label htmlFor="budget-alerts" className="text-sm font-normal">
                  Alertas de presupuesto
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Recibe avisos cuando uses el 80% de una categoría
                </p>
              </div>
              <Switch id="budget-alerts" defaultChecked />
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <Label htmlFor="payment-reminders" className="text-sm font-normal">
                  Recordatorios de pago
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Notificaciones antes de fechas de vencimiento
                </p>
              </div>
              <Switch id="payment-reminders" defaultChecked />
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <Label htmlFor="weekly-summary" className="text-sm font-normal">
                  Resumen semanal
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Recibe un resumen cada domingo
                </p>
              </div>
              <Switch id="weekly-summary" />
            </div>
          </div>
        </div>

        {/* Help & Support */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <HelpCircle className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-medium text-foreground">Ayuda</h2>
          </div>
          <div className="divide-y divide-border">
            <button className="flex items-center justify-between w-full p-4 text-left hover:bg-muted/50 transition-colors">
              <span className="text-sm text-foreground">Centro de ayuda</span>
              <span className="text-muted-foreground">→</span>
            </button>
            <button className="flex items-center justify-between w-full p-4 text-left hover:bg-muted/50 transition-colors">
              <span className="text-sm text-foreground">Contactar soporte</span>
              <span className="text-muted-foreground">→</span>
            </button>
            <button className="flex items-center justify-between w-full p-4 text-left hover:bg-muted/50 transition-colors">
              <span className="text-sm text-foreground">Términos y condiciones</span>
              <span className="text-muted-foreground">→</span>
            </button>
          </div>
        </div>
      </div>

      {/* App Version */}
      <p className="text-center text-xs text-muted-foreground">
        Finanzas con Sentido™ v1.0.0
      </p>
    </div>
  );
}
