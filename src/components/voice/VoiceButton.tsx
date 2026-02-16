import { useState, useCallback, useEffect } from "react";
import { Mic, MicOff, Loader2, Check, Edit2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
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
  const [committedText, setCommittedText] = useState("");
  const [partialText, setPartialText] = useState("");
  const [parsedData, setParsedData] = useState<ParsedTransaction | null>(null);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => {
      setPartialText(data.text);
    },
    onCommittedTranscript: (data) => {
      // Accumulate committed text instead of replacing
      setCommittedText((prev) => {
        const newText = prev ? `${prev} ${data.text}` : data.text;
        return newText.trim();
      });
      setPartialText("");
    },
  });

  // Auto-start recording when drawer opens
  useEffect(() => {
    if (isOpen && !scribe.isConnected && !isConnecting && !parsedData) {
      handleStartRecording();
    }
  }, [isOpen]);

  const handleStartRecording = useCallback(async () => {
    setIsConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const { data, error } = await supabase.functions.invoke(
        "elevenlabs-scribe-token"
      );

      if (error) {
        throw new Error(error.message || "Error getting token");
      }

      if (!data?.token) {
        throw new Error("No se recibió token de autenticación");
      }

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
    // Parse the final committed text
    const finalText = committedText || partialText;
    if (finalText) {
      const parsed = parseTransaction(finalText);
      setParsedData(parsed);
      // Ensure committed text has the final version
      if (!committedText && partialText) {
        setCommittedText(partialText);
        setPartialText("");
      }
    }
  }, [scribe, committedText, partialText]);

  const displayTranscript = committedText + (partialText ? ` ${partialText}` : "");

  const handleConfirm = async () => {
    if (!parsedData?.amount || !user) return;
    
    setIsSaving(true);
    try {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, currency')
        .limit(1);
      
      let accountId = accounts?.[0]?.id;
      
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
          description: parsedData.description || committedText,
          transaction_date: (parsedData.date || new Date()).toISOString().split('T')[0],
          voice_transcript: committedText,
        });

      if (error) throw error;

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
    setCommittedText("");
    setPartialText("");
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

      {/* Voice Recording Drawer (mobile-friendly) */}
      <Drawer open={isOpen} onOpenChange={(open) => {
        if (!open) handleCancel();
        else setIsOpen(true);
      }}>
        <DrawerContent className="max-h-[95vh] min-h-[70vh]">
          <div className="mx-auto w-full max-w-md flex flex-col h-full overflow-hidden">
            <DrawerHeader className="text-center pb-1 shrink-0">
              <DrawerTitle className="font-heading text-base">
                Registrar por voz
              </DrawerTitle>
              <DrawerDescription className="text-xs">
                Dicta tu movimiento y lo interpretaremos
              </DrawerDescription>
            </DrawerHeader>

            <div className="flex flex-col items-center px-4 pb-4 space-y-3 overflow-y-auto flex-1 min-h-0">
              {/* Recording Button */}
              <button
                onClick={scribe.isConnected ? handleStopRecording : handleStartRecording}
                disabled={isConnecting}
                className={cn(
                  "flex h-20 w-20 items-center justify-center rounded-full transition-all shrink-0",
                  scribe.isConnected
                    ? "bg-expense text-expense-foreground animate-pulse-gentle"
                    : "bg-primary text-primary-foreground hover:scale-105",
                  isConnecting && "opacity-50 cursor-not-allowed"
                )}
              >
                {isConnecting ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : scribe.isConnected ? (
                  <MicOff className="h-8 w-8" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </button>

              <p className="text-sm text-muted-foreground text-center">
                {isConnecting
                  ? "Conectando..."
                  : scribe.isConnected
                  ? "Escuchando... Toca para detener"
                  : parsedData
                  ? "Revisa tu movimiento"
                  : "Toca para hablar"}
              </p>

              {/* Live Transcript - only show committed text firmly, partial dimmed */}
              {scribe.isConnected && displayTranscript && (
                <div className="w-full animate-fade-in">
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="text-center text-foreground text-sm">
                      {committedText && (
                        <span className="font-medium">{committedText} </span>
                      )}
                      {partialText && (
                        <span className="text-muted-foreground italic">{partialText}</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Parsed Result Display */}
              {!scribe.isConnected && parsedData && (
                <div className="w-full animate-fade-in-up space-y-3">
                  <div className="rounded-lg bg-secondary p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Detecté:</p>
                    <p className="font-medium text-foreground text-sm">{committedText}</p>
                  </div>

                  {/* Parsed Data Preview - compact */}
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between py-1.5 border-b border-border">
                      <span className="text-muted-foreground">Tipo:</span>
                      <span className={cn("font-medium", getTypeColor(parsedData.type))}>
                        {getTypeLabel(parsedData.type)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border">
                      <span className="text-muted-foreground">Monto:</span>
                      <span className="font-medium">
                        {formatAmount(parsedData.amount, parsedData.currency)}
                      </span>
                    </div>
                    {parsedData.category && (
                      <div className="flex justify-between py-1.5 border-b border-border">
                        <span className="text-muted-foreground">Categoría:</span>
                        <span className="font-medium">{parsedData.category}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1.5 border-b border-border">
                      <span className="text-muted-foreground">Fecha:</span>
                      <span className="font-medium">{parsedData.dateLabel || "Hoy"}</span>
                    </div>
                    {parsedData.description && parsedData.description !== committedText && (
                      <div className="flex justify-between py-1.5">
                        <span className="text-muted-foreground">Descripción:</span>
                        <span className="font-medium truncate max-w-[180px]">
                          {parsedData.description}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Confidence */}
                  <div className="flex items-center gap-2">
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
                      {parsedData.confidence}%
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 pb-2 shrink-0">
                    <Button
                      variant="outline"
                      size="default"
                      className="flex-1 gap-1.5"
                      onClick={handleCancel}
                    >
                      <X className="h-4 w-4" />
                      Cancelar
                    </Button>
                    <Button
                      variant="outline"
                      size="default"
                      className="flex-1 gap-1.5"
                      onClick={handleReset}
                    >
                      <Edit2 className="h-4 w-4" />
                      Reintentar
                    </Button>
                    <Button 
                      size="default"
                      className="flex-1 gap-1.5" 
                      onClick={handleConfirm}
                      disabled={!parsedData.amount || isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      {isSaving ? "..." : "Confirmar"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
