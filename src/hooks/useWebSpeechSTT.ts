import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { sanitizeTranscript } from "@/lib/voiceParser";

export function useWebSpeechSTT() {
  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [finalText, setFinalText] = useState("");
  const finalSegmentsRef = useRef<string[]>([]);

  const isSupported = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const start = useCallback(() => {
    if (!isSupported) {
      toast.error("Tu navegador no soporta reconocimiento de voz.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = "es-MX";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognition.onresult = (event: any) => {
      let currentInterim = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const transcript = result[0].transcript.trim();
          if (transcript) {
            const existing = finalSegmentsRef.current.join(" ").toLowerCase();
            if (!existing.includes(transcript.toLowerCase())) {
              finalSegmentsRef.current.push(transcript);
              const joined = finalSegmentsRef.current.join(" ");
              setFinalText(sanitizeTranscript(joined));
            }
          }
          currentInterim = "";
        } else {
          currentInterim = result[0].transcript;
        }
      }
      setInterimText(currentInterim);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        toast.error("Permite el acceso al micrófono para usar voz.");
      } else if (event.error === "no-speech") {
        // Silent
      } else if (event.error !== "aborted") {
        toast.error("Error de reconocimiento. Intenta de nuevo.");
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    finalSegmentsRef.current = [];
    setFinalText("");
    setInterimText("");

    try {
      recognition.start();
      setIsListening(true);
      if (navigator.vibrate) navigator.vibrate(100);
    } catch (e) {
      console.error("Failed to start recognition:", e);
      toast.error("No se pudo iniciar el micrófono.");
    }
  }, [isSupported]);

  const stop = useCallback((): string => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);

    const segments = finalSegmentsRef.current.join(" ");
    const result = sanitizeTranscript((segments + " " + interimText).trim());
    setInterimText("");
    return result;
  }, [interimText]);

  const reset = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimText("");
    setFinalText("");
    finalSegmentsRef.current = [];
  }, []);

  return { isListening, interimText, finalText, isSupported, start, stop, reset };
}
