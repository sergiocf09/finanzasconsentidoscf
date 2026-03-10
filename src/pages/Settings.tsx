import { useState, useEffect } from "react";
import { User, Bell, DollarSign, Shield, HelpCircle, Loader2, LogOut, Mail, Check, X } from "lucide-react";
import { ArchivedItemsSection } from "@/components/settings/ArchivedItemsSection";
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

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Name editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  // Email editing
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  // Password
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

  const handleSaveEmail = async () => {
    if (!newEmail.trim() || !emailPassword) return;

    setIsSavingEmail(true);
    try {
      // Verify current password first
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: emailPassword,
      });

      if (authError) {
        toast({ title: "Contraseña incorrecta", description: "Verifica tu contraseña actual.", variant: "destructive" });
        setIsSavingEmail(false);
        return;
      }

      // Update email (Supabase sends confirmation to both old and new email)
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({
          title: "Verificación enviada",
          description: "Revisa tu correo actual y el nuevo para confirmar el cambio.",
        });
        setIsEditingEmail(false);
        setEmailPassword("");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setIsSavingEmail(false);
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
    <div className="space-y-2">
      {/* Header — sticky */}
      <div className="bg-background -mx-1 px-1 pb-1">
        <h1 className="text-lg font-heading font-semibold text-foreground py-1">Configuración</h1>
      </div>

      {/* Account */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <User className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">Cuenta</h2>
        </div>
        <div className="divide-y divide-border">
          {/* Name */}
          <div className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Nombre</span>
              {!isEditingName && (
                <button
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors truncate max-w-[50%] text-right"
                  onClick={() => { setNewName(displayName); setIsEditingName(true); }}
                >
                  {isLoading ? "..." : displayName} →
                </button>
              )}
            </div>
            {isEditingName && (
              <div className="mt-2 space-y-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-9"
                  placeholder={displayName}
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setIsEditingName(false)}>
                    Cancelar
                  </Button>
                  <Button size="sm" className="h-8 text-xs" onClick={handleSaveName} disabled={isSavingName}>
                    {isSavingName ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                    Guardar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Email */}
          <div className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Email</span>
              {!isEditingEmail && (
                <button
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors truncate max-w-[55%] text-right"
                  onClick={() => { setNewEmail(""); setEmailPassword(""); setIsEditingEmail(true); }}
                >
                  {isLoading ? "..." : displayEmail} →
                </button>
              )}
            </div>
            {isEditingEmail && (
              <div className="mt-2 space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Nuevo correo electrónico</Label>
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="h-9"
                    placeholder="nuevo@correo.com"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Contraseña actual (verificación)</Label>
                  <Input
                    type="password"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    className="h-9"
                    placeholder="Tu contraseña"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Se enviará un enlace de confirmación al correo actual y al nuevo.
                </p>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setIsEditingEmail(false)}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    onClick={handleSaveEmail}
                    disabled={isSavingEmail || !newEmail.trim() || !emailPassword}
                  >
                    {isSavingEmail ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Mail className="h-3 w-3 mr-1" />}
                    Verificar y cambiar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">Seguridad</h2>
        </div>
        <div className="divide-y divide-border">
          {showPasswordForm ? (
            <div className="p-4 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="new-password" className="text-xs">Nueva contraseña</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-9"
                />
                <PasswordRequirements password={newPassword} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirm-password" className="text-xs">Confirmar contraseña</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Repite tu contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowPasswordForm(false)}>
                  Cancelar
                </Button>
                <Button size="sm" className="h-8 text-xs" onClick={handleChangePassword} disabled={isSavingPassword}>
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
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">Moneda</h2>
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
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">Notificaciones</h2>
        </div>
        <div className="divide-y divide-border">
          <div className="flex items-center justify-between p-4">
            <div className="flex-1 min-w-0 mr-3">
              <Label htmlFor="budget-alerts" className="text-sm font-normal">Alertas de presupuesto</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Aviso al usar el 80% de una categoría</p>
            </div>
            <Switch id="budget-alerts" defaultChecked />
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="flex-1 min-w-0 mr-3">
              <Label htmlFor="payment-reminders" className="text-sm font-normal">Recordatorios de pago</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Antes de fechas de vencimiento</p>
            </div>
            <Switch id="payment-reminders" defaultChecked />
          </div>
        </div>
      </div>

      {/* Archived Items */}
      <ArchivedItemsSection />

      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">Ayuda</h2>
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

      <p className="text-center text-xs text-muted-foreground pb-2">
        Finanzas con Sentido™ v1.0.0
      </p>
    </div>
  );
}
