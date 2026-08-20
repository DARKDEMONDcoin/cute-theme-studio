import { useCallback, useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { toast } from "sonner";

interface Props {
  /** Appends recognized speech to the composer value. */
  onTranscript: (text: string) => void;
  /** Notifies the composer so it can switch to the recording animation. */
  onListeningChange?: (listening: boolean) => void;
  lang?: string;
}

/**
 * Real dictation button using the Web Speech API. Transparent (no background,
 * no border); turns mint while listening.
 */
export function ComposerMicButton({ onTranscript, onListeningChange, lang = "ar-EG" }: Props) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const cbRef = useRef(onTranscript);
  cbRef.current = onTranscript;

  useEffect(() => {
    onListeningChange?.(listening);
  }, [listening, onListeningChange]);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) {
      toast.error("Your browser does not support voice input");
      return;
    }
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const text = Array.from(e.results)
        .map((r: any) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (text) cbRef.current(text);
    };
    rec.onerror = () => {
      setListening(false);
      toast.error("Couldn't start the microphone");
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [lang]);

  useEffect(() => () => stop(), [stop]);

  return (
    <button
      type="button"
      onClick={() => (listening ? stop() : start())}
      aria-label={listening ? "Stop recording" : "Voice input"}
      aria-pressed={listening}
      className="shrink-0 inline-flex w-9 h-9 items-center justify-center rounded-full border-0 bg-transparent outline-none transition-opacity hover:opacity-80 active:scale-95"
      style={{ background: "transparent", border: 0, boxShadow: "none" }}
    >
      <Mic
        className={`w-[20px] h-[20px] transition-colors ${listening ? "text-primary" : "text-foreground/70"}`}
        strokeWidth={1.9}
      />
    </button>
  );
}

export default ComposerMicButton;
