import { useState } from "react";
import { User, Bell, DollarSign, Shield, HelpCircle, Loader2, LogOut } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { validatePassword } from "@/lib/passwordValidation";
import { PasswordRequirements } from "@/components/auth/PasswordRequirements";

export default function Settings() {
  const { profile, isLoading } = useProfile();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    setIsSavingName(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: newName.trim() })
      .eq("id", user!.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: "Nombre actualizado" });
      setIsEditingName(false);
    }
    setIsSavingName(false);
  };

  const handleChangePassword = async () => {
    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      toast({ title: "Contraseña no válida", description: validation.errors.join(". "), variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Las contraseñas no coinciden", variant: "destructive" });
      return;
    }
    setIsSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Contraseña actualizada correctamente" });
      setShowPasswordForm(false);
      setNewPassword("");
      setConfirmPassword("");
    }
    setIsSavingPassword(false);
  };

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Usuario";
  const displayEmail = profile?.email || user?.email || "—";
  const displayCurrency = profile?.base_currency || "MXN";

  return (
    <div className="space-y-6">
      {/* Header — sticky */}
      <div className="sticky top-14 lg:top-0 z-10 bg-background/95 backdrop-blur-sm pb-2 -mx-1 px-1 pt-1">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-heading font-semibold text-foreground">Configuración</h1>
        </div>
      </div>

      <div className="space-y-6">
        {/* Account */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <User className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-medium text-foreground">Cuenta</h2>
          </div>
          <div className="divide-y divide-border">
            {/* Name */}
            <div className="flex items-center justify-between p-4">
              <span className="text-sm text-foreground">Nombre</span>
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-8 w-40"
                    placeholder={displayName}
                    autoFocus
                  />
                  <Button size="sm" variant="ghost" onClick={() => setIsEditingName(false)}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSaveName} disabled={isSavingName}>
                    {isSavingName ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
                  </Button>
                </div>
              ) : (
                <button
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => { setNewName(displayName); setIsEditingName(true); }}
                >
                  {isLoading ? "..." : displayName} →
                </button>
              )}
            </div>
            {/* Email */}
            <div className="flex items-center justify-between p-4">
              <span className="text-sm text-foreground">Email</span>
              <span className="text-sm text-muted-foreground">
                {isLoading ? "..." : displayEmail}
              </span>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-medium text-foreground">Seguridad</h2>
          </div>
          <div className="divide-y divide-border">
            {showPasswordForm ? (
              <div className="p-4 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-sm">Nueva contraseña</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-sm">Confirmar contraseña</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Repite tu contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowPasswordForm(false)}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleChangePassword} disabled={isSavingPassword}>
                    {isSavingPassword ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Cambiar contraseña
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-foreground">Contraseña</span>
                <button
                  className="text-sm text-primary hover:underline"
                  onClick={() => setShowPasswordForm(true)}
                >
                  Cambiar contraseña →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Currency */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-medium text-foreground">Moneda</h2>
          </div>
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between p-4">
              <span className="text-sm text-foreground">Moneda principal</span>
              <span className="text-sm text-muted-foreground">{displayCurrency}</span>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-medium text-foreground">Notificaciones</h2>
          </div>
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between p-4">
              <div>
                <Label htmlFor="budget-alerts" className="text-sm font-normal">Alertas de presupuesto</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Recibe avisos cuando uses el 80% de una categoría</p>
              </div>
              <Switch id="budget-alerts" defaultChecked />
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <Label htmlFor="payment-reminders" className="text-sm font-normal">Recordatorios de pago</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Notificaciones antes de fechas de vencimiento</p>
              </div>
              <Switch id="payment-reminders" defaultChecked />
            </div>
          </div>
        </div>

        {/* Help */}
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
              <span className="text-sm text-foreground">Términos y condiciones</span>
              <span className="text-muted-foreground">→</span>
            </button>
          </div>
        </div>

        {/* Sign Out */}
        <Button variant="outline" className="w-full gap-2 text-destructive hover:text-destructive" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Finanzas con Sentido™ v1.0.0
      </p>
    </div>
  );
}
