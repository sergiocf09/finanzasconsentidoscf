import { useState, useCallback } from "react";
import { Mic, MicOff, Loader2, Check, Edit2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { parseTransaction, type ParsedTransaction } from "@/hooks/useTransactionParser";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

export function VoiceButton() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parsedData, setParsedData] = useState<ParsedTransaction | null>(null);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => {
      setTranscript(data.text);
    },
    onCommittedTranscript: (data) => {
      setTranscript(data.text);
      // Parse the transaction when transcript is committed
      const parsed = parseTransaction(data.text);
      setParsedData(parsed);
    },
  });

  const handleStartRecording = useCallback(async () => {
    setIsConnecting(true);
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get token from edge function
      const { data, error } = await supabase.functions.invoke(
        "elevenlabs-scribe-token"
      );

      if (error) {
        throw new Error(error.message || "Error getting token");
      }

      if (!data?.token) {
        throw new Error("No se recibió token de autenticación");
      }

      // Start the scribe session
      await scribe.connect({
        token: data.token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast.error("No se pudo iniciar la grabación. Verifica los permisos del micrófono.");
    } finally {
      setIsConnecting(false);
    }
  }, [scribe]);

  const handleStopRecording = useCallback(async () => {
    await scribe.disconnect();
    // Final parse after stopping
    if (transcript) {
      const parsed = parseTransaction(transcript);
      setParsedData(parsed);
    }
  }, [scribe, transcript]);

  const handleConfirm = async () => {
    if (!parsedData?.amount || !user) return;
    
    setIsSaving(true);
    try {
      // Get the user's first account (or default)
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, currency')
        .limit(1);
      
      let accountId = accounts?.[0]?.id;
      
      // If no account exists, create a default one
      if (!accountId) {
        const { data: newAccount, error: accountError } = await supabase
          .from('accounts')
          .insert({
            user_id: user.id,
            name: 'Cuenta Principal',
            type: 'bank',
            currency: parsedData.currency || 'MXN',
            initial_balance: 0,
            current_balance: 0,
          })
          .select('id')
          .single();
        
        if (accountError) throw accountError;
        accountId = newAccount.id;
      }

      // Find matching category
      let categoryId: string | undefined;
      if (parsedData.category) {
        const { data: categories } = await supabase
          .from('categories')
          .select('id, name')
          .ilike('name', `%${parsedData.category}%`)
          .limit(1);
        
        categoryId = categories?.[0]?.id;
      }

      const { error } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          account_id: accountId,
          category_id: categoryId || null,
          type: parsedData.type,
          amount: parsedData.amount,
          currency: parsedData.currency || 'MXN',
          description: parsedData.description || transcript,
          transaction_date: (parsedData.date || new Date()).toISOString().split('T')[0],
          voice_transcript: transcript,
        });

      if (error) throw error;

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });

      toast.success("Movimiento registrado correctamente");
      handleReset();
      setIsOpen(false);
    } catch (error: any) {
      console.error("Error saving transaction:", error);
      toast.error("No se pudo guardar el movimiento: " + (error.message || "Error desconocido"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setTranscript("");
    setParsedData(null);
  };

  const handleCancel = async () => {
    if (scribe.isConnected) {
      await scribe.disconnect();
    }
    handleReset();
    setIsOpen(false);
  };

  const formatAmount = (amount: number | null, currency: string | null) => {
    if (!amount) return "—";
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: currency || "MXN",
    }).format(amount);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "expense": return "Gasto";
      case "income": return "Ingreso";
      case "transfer": return "Transferencia";
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "expense": return "text-expense";
      case "income": return "text-income";
      case "transfer": return "text-transfer";
      default: return "text-foreground";
    }
  };

  return (
    <>
      {/* Floating Voice Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevated transition-all hover:scale-105 active:scale-95",
          "bottom-20 right-4 lg:bottom-6 lg:right-6",
          "voice-button-pulse"
        )}
        aria-label="Registrar por voz"
      >
        <Mic className="h-6 w-6" />
      </button>

      {/* Voice Recording Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center font-heading">
              Registrar por voz
            </DialogTitle>
            <DialogDescription className="text-center text-sm">
              Dicta tu movimiento y lo interpretaremos automáticamente
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center py-8 space-y-6">
            {/* Recording Button */}
            <button
              onClick={scribe.isConnected ? handleStopRecording : handleStartRecording}
              disabled={isConnecting}
              className={cn(
                "flex h-24 w-24 items-center justify-center rounded-full transition-all",
                scribe.isConnected
                  ? "bg-expense text-expense-foreground animate-pulse-gentle"
                  : "bg-primary text-primary-foreground hover:scale-105",
                isConnecting && "opacity-50 cursor-not-allowed"
              )}
            >
              {isConnecting ? (
                <Loader2 className="h-10 w-10 animate-spin" />
              ) : scribe.isConnected ? (
                <MicOff className="h-10 w-10" />
              ) : (
                <Mic className="h-10 w-10" />
              )}
            </button>

            <p className="text-sm text-muted-foreground text-center">
              {isConnecting
                ? "Conectando..."
                : scribe.isConnected
                ? "Escuchando... Toca para detener"
                : "Toca para hablar"}
            </p>

            {/* Live Transcript */}
            {scribe.isConnected && transcript && (
              <div className="w-full px-4 animate-fade-in">
                <p className="text-center text-muted-foreground italic">
                  "{transcript}"
                </p>
              </div>
            )}

            {/* Parsed Result Display */}
            {!scribe.isConnected && parsedData && (
              <div className="w-full animate-fade-in-up">
                <div className="rounded-lg bg-secondary p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">
                    Detecté:
                  </p>
                  <p className="font-medium text-foreground">{transcript}</p>
                </div>

                {/* Parsed Data Preview */}
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Tipo:</span>
                    <span className={cn("font-medium", getTypeColor(parsedData.type))}>
                      {getTypeLabel(parsedData.type)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Monto:</span>
                    <span className="font-medium">
                      {formatAmount(parsedData.amount, parsedData.currency)}
                    </span>
                  </div>
                  {parsedData.category && (
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Categoría:</span>
                      <span className="font-medium">{parsedData.category}</span>
                    </div>
                  )}
                  {parsedData.paymentMethod && (
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Método:</span>
                      <span className="font-medium">{parsedData.paymentMethod}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Fecha:</span>
                    <span className="font-medium">{parsedData.dateLabel || "Hoy"}</span>
                  </div>
                  {parsedData.type === "transfer" && (parsedData.fromAccount || parsedData.toAccount) && (
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Cuentas:</span>
                      <span className="font-medium">
                        {parsedData.fromAccount || "—"} → {parsedData.toAccount || "—"}
                      </span>
                    </div>
                  )}
                  {parsedData.description && parsedData.description !== transcript && (
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Descripción:</span>
                      <span className="font-medium truncate max-w-[180px]">
                        {parsedData.description}
                      </span>
                    </div>
                  )}
                </div>

                {/* Confidence Indicator */}
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all",
                        parsedData.confidence >= 70 ? "bg-income" :
                        parsedData.confidence >= 40 ? "bg-warning" : "bg-expense"
                      )}
                      style={{ width: `${parsedData.confidence}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {parsedData.confidence}% confianza
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={handleCancel}
                  >
                    <X className="h-4 w-4" />
                    Cancelar
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={handleReset}
                  >
                    <Edit2 className="h-4 w-4" />
                    Reintentar
                  </Button>
                  <Button 
                    className="flex-1 gap-2" 
                    onClick={handleConfirm}
                    disabled={!parsedData.amount || isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {isSaving ? "Guardando..." : "Confirmar"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
