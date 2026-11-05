"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// The Web Speech API is not in TypeScript's DOM types yet: describe only what we use.
interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  isFinal: boolean;
  [index: number]: RecognitionAlternative;
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Permite el uso del micrófono en tu navegador.",
  "service-not-allowed": "Permite el uso del micrófono en tu navegador.",
  "no-speech": "No te oí. Inténtalo de nuevo.",
  "audio-capture": "No encuentro un micrófono.",
  network: "El reconocimiento de voz necesita conexión a internet.",
};

const subscribe = () => () => {};

/**
 * Dictation with the browser's speech recognition (Chrome, Edge, Safari).
 * `onInterim` receives the words as they are recognised; `onFinal` the finished phrase.
 */
export function useSpeech(onFinal: (text: string) => void, onInterim?: (text: string) => void) {
  const supported = useSyncExternalStore(subscribe, () => getCtor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recRef = useRef<Recognition | null>(null);
  const finalRef = useRef(onFinal);
  const interimRef = useRef(onInterim);

  useEffect(() => {
    finalRef.current = onFinal;
    interimRef.current = onInterim;
  });

  const stop = useCallback(() => recRef.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor || recRef.current) return;
    setError("");
    const rec = new Ctor();
    rec.lang = navigator.language?.toLowerCase().startsWith("es") ? navigator.language : "es-ES";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += text;
        else interim += text;
      }
      if (interim) interimRef.current?.(interim);
      if (final.trim()) finalRef.current(final.trim());
    };
    rec.onerror = (e) => {
      if (e.error !== "aborted") setError(ERRORS[e.error] ?? `Error de voz: ${e.error}`);
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
    };
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      recRef.current = null;
      setListening(false);
    }
  }, []);

  // Stop listening if the component goes away
  useEffect(() => () => recRef.current?.abort(), []);

  return { supported, listening, error, start, stop };
}
