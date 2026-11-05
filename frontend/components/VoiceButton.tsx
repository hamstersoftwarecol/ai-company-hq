"use client";

import { useSpeech } from "@/hooks/useSpeech";

interface Props {
  /** Called with each finished phrase. */
  onFinal: (text: string) => void;
  /** Called with the words as they are recognised. */
  onInterim?: (text: string) => void;
  label?: string;
}

/** Push-to-talk style button: click, speak, it stops by itself when you pause. */
export default function VoiceButton({ onFinal, onInterim, label = "HABLAR" }: Props) {
  const { supported, listening, error, start, stop } = useSpeech(onFinal, onInterim);

  if (!supported) {
    return (
      <button type="button" disabled className="px-btn px-btn-ghost shrink-0" title="Tu navegador no tiene reconocimiento de voz. Prueba con Chrome, Edge o Safari.">
        SIN VOZ
      </button>
    );
  }

  return (
    <span className="inline-flex shrink-0 flex-col gap-1">
      <button
        type="button"
        onClick={listening ? stop : start}
        aria-pressed={listening}
        className="px-btn px-btn-ghost inline-flex items-center justify-center gap-2"
        style={listening ? { background: "#fee2e2" } : undefined}
      >
        <span
          className="inline-block h-2.5 w-2.5 border border-[#3a2f2a]"
          style={{ background: listening ? "#ef4444" : "#9ca3af" }}
          aria-hidden
        />
        {listening ? "ESCUCHANDO…" : label}
      </button>
      {error && (
        <span role="status" className="max-w-48 text-[11px] font-medium text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
