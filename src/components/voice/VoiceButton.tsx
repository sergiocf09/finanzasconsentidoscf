import { useState } from "react";
import { Mic, MicOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function VoiceButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");

  const handleStartRecording = () => {
    setIsRecording(true);
    // Voice recording will be implemented with ElevenLabs STT
    // For now, show recording state
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    // Simulate a transcript for demo
    setTranscript("Gasté 250 pesos en Uber ayer");
  };

  const handleConfirm = () => {
    // Process the transaction
    setTranscript("");
    setIsOpen(false);
  };

  const handleCancel = () => {
    setTranscript("");
    setIsRecording(false);
    setIsOpen(false);
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
          </DialogHeader>

          <div className="flex flex-col items-center py-8 space-y-6">
            {/* Recording Button */}
            <button
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              className={cn(
                "flex h-24 w-24 items-center justify-center rounded-full transition-all",
                isRecording
                  ? "bg-expense text-expense-foreground animate-pulse-gentle"
                  : "bg-primary text-primary-foreground hover:scale-105"
              )}
            >
              {isRecording ? (
                <MicOff className="h-10 w-10" />
              ) : (
                <Mic className="h-10 w-10" />
              )}
            </button>

            <p className="text-sm text-muted-foreground text-center">
              {isRecording
                ? "Escuchando... Toca para detener"
                : "Toca para hablar"}
            </p>

            {/* Transcript Display */}
            {transcript && (
              <div className="w-full animate-fade-in-up">
                <div className="rounded-lg bg-secondary p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">
                    Detecté:
                  </p>
                  <p className="font-medium text-foreground">{transcript}</p>
                </div>

                {/* Parsed Result Preview */}
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Tipo:</span>
                    <span className="font-medium text-expense">Gasto</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Monto:</span>
                    <span className="font-medium">$250.00 MXN</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Categoría:</span>
                    <span className="font-medium">Transporte</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Fecha:</span>
                    <span className="font-medium">Ayer</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleCancel}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setTranscript("")}
                  >
                    Editar
                  </Button>
                  <Button className="flex-1" onClick={handleConfirm}>
                    Confirmar
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
