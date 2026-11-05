"use client";

import { useState } from "react";

interface Props {
  onSubmit: (instruction: string) => void;
  disabled: boolean;
}

export function CommandInput({ onSubmit, disabled }: Props) {
  const [value, setValue] = useState("");

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      <textarea
        className="w-full rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 p-3 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
        rows={3}
        placeholder="Da una instrucción a tu empresa de IA…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
        }}
        disabled={disabled}
      />
      <button
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
      >
        {disabled ? "Procesando…" : "Enviar"}
      </button>
    </div>
  );
}
