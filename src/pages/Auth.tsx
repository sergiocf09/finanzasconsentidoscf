import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Leaf, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { validatePassword } from "@/lib/passwordValidation";
import { PasswordRequirements } from "@/components/auth/PasswordRequirements";
import { supabase } from "@/integrations/supabase/client";

export default function Auth() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const getErrorMessage = (errorMessage: string): string => {
    if (errorMessage.includes("Invalid login credentials")) return "Correo o contraseña incorrectos.";
    if (errorMessage.includes("Email not confirmed")) return "Tu correo aún no ha sido confirmado. Revisa tu bandeja de entrada (y spam) para verificar tu cuenta.";
    if (errorMessage.includes("For security purposes")) return "Por seguridad, espera unos segundos antes de intentar de nuevo.";
    if (errorMessage.includes("User already registered")) return "Este correo ya está registrado. Intenta iniciar sesión.";
    return errorMessage;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const { error } = await signIn(loginEmail, loginPassword);
    if (error) {
      toast({ title: "Error al iniciar sesión", description: getErrorMessage(error.message), variant: "destructive" });
    } else {
      navigate("/");
    }
    setIsSubmitting(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validatePassword(registerPassword);
    if (!validation.isValid) {
      toast({ title: "Contraseña no válida", description: validation.errors.join(". "), variant: "destructive" });
      return;
    }
    if (registerPassword !== registerConfirmPassword) {
      toast({ title: "Las contraseñas no coinciden", description: "Por favor, verifica que ambas contraseñas sean iguales.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const { error } = await signUp(registerEmail, registerPassword, registerName);
    if (error) {
      toast({ title: "Error al registrarse", description: getErrorMessage(error.message), variant: "destructive" });
    } else {
      toast({ title: "¡Registro exitoso!", description: "Revisa tu correo electrónico (incluida la carpeta de spam) para confirmar tu cuenta antes de iniciar sesión." });
    }
    setIsSubmitting(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setIsSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ title: "Error", description: getErrorMessage(error.message), variant: "destructive" });
    } else {
      toast({ title: "Correo enviado", description: "Revisa tu bandeja de entrada para restablecer tu contraseña." });
      setShowForgotPassword(false);
    }
    setIsSendingReset(false);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--gradient-hero)" }}>
      {/* Hero section */}
      <div className="flex flex-col items-center justify-center px-6 pt-14 pb-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm mb-5 border border-white/15">
          <Leaf className="h-7 w-7 text-gold" />
        </div>
        
        <h1 className="font-heading text-3xl font-bold text-white leading-tight mb-1">
          Tu dinero con calma.
        </h1>
        <p className="text-2xl font-heading font-semibold text-gold leading-tight mb-3">
          Tu vida con sentido.
        </p>
        <p className="text-sm text-white/70 max-w-xs">
          Ordena tus finanzas de manera simple y empieza a vivir con la certeza de que cada decisión construye tu futuro.
        </p>
      </div>

      {/* Form card */}
      <div className="flex-1 px-4 pb-6">
        <Card className="w-full max-w-md mx-auto border-0 shadow-2xl bg-white/10 backdrop-blur-md rounded-2xl border border-white/15">
          {showForgotPassword ? (
            <>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Recuperar contraseña</CardTitle>
                <CardDescription>
                  Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Correo electrónico</Label>
                    <Input id="forgot-email" type="email" placeholder="tu@correo.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full bg-gold hover:bg-gold/90 text-gold-foreground" disabled={isSendingReset}>
                    {isSendingReset ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</>) : "Enviar enlace"}
                  </Button>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => setShowForgotPassword(false)}>
                    Volver a iniciar sesión
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
            <Tabs defaultValue="login" className="w-full">
              <CardHeader className="pb-3">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Iniciar sesión</TabsTrigger>
                  <TabsTrigger value="register">Registrarse</TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent>
                <TabsContent value="login" className="mt-0">
                  <form onSubmit={handleLogin} className="space-y-5">
                    <p className="text-center text-lg font-heading font-semibold text-gold">Bienvenido de nuevo</p>
                    <div className="space-y-1.5">
                      <Label htmlFor="login-email" className="text-gold font-medium">Correo electrónico</Label>
                      <Input id="login-email" type="email" placeholder="tu@correo.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="login-password" className="text-gold font-medium">Contraseña</Label>
                      <Input id="login-password" type="password" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                    </div>
                    <Button type="submit" className="w-full bg-gold hover:bg-gold/90 text-gold-foreground font-semibold" disabled={isSubmitting}>
                      {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Iniciando...</>) : "Iniciar sesión"}
                    </Button>
                    <button type="button" className="w-full text-sm text-gold/80 hover:text-gold hover:underline text-center" onClick={() => setShowForgotPassword(true)}>
                      ¿Olvidaste tu contraseña?
                    </button>
                  </form>
                </TabsContent>

                <TabsContent value="register" className="mt-0">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="text-center">
                      <p className="text-lg font-heading font-semibold text-gold">Crea tu cuenta</p>
                      <p className="text-sm text-white/90 mt-1">Comienza a ordenar tus finanzas hoy.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="register-name" className="text-gold font-medium">Tu nombre</Label>
                      <Input id="register-name" type="text" placeholder="¿Cómo te llamamos?" value={registerName} onChange={(e) => setRegisterName(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="register-email" className="text-gold font-medium">Correo electrónico</Label>
                      <Input id="register-email" type="email" placeholder="tu@correo.com" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="register-password" className="text-gold font-medium">Contraseña</Label>
                      <Input id="register-password" type="password" placeholder="Mínimo 8 caracteres" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} required />
                      <PasswordRequirements password={registerPassword} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="register-confirm" className="text-gold font-medium">Confirmar contraseña</Label>
                      <Input id="register-confirm" type="password" placeholder="Repite tu contraseña" value={registerConfirmPassword} onChange={(e) => setRegisterConfirmPassword(e.target.value)} required />
                    </div>
                    <Button type="submit" className="w-full bg-gold hover:bg-gold/90 text-gold-foreground font-semibold" disabled={isSubmitting}>
                      {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando cuenta...</>) : "Crear cuenta"}
                    </Button>
                  </form>
                </TabsContent>
              </CardContent>
            </Tabs>
          )}
        </Card>

        <p className="mt-4 text-xs text-white/50 text-center max-w-sm mx-auto">
          Al registrarte, aceptas nuestros términos de servicio y política de privacidad.
        </p>
      </div>
    </div>
  );
}
