"use client";

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface KeyStatus {
  anthropic_configured: boolean;
  openai_configured: boolean;
  anthropic_key_hint: string;
  openai_key_hint: string;
}

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/settings`)
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const body: Record<string, string> = {};
      if (anthropicKey.trim()) body.anthropic_api_key = anthropicKey.trim();
      if (openaiKey.trim()) body.openai_api_key = openaiKey.trim();
      const res = await fetch(`${API_URL}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
      setAnthropicKey("");
      setOpenaiKey("");
      const updated = await fetch(`${API_URL}/settings`).then((r) => r.json());
      setStatus(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-lg">Configuración de API</h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Anthropic / Claude */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-white/80">Claude (Anthropic)</span>
            {status && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  status.anthropic_configured
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {status.anthropic_configured
                  ? `Configurado ${status.anthropic_key_hint}`
                  : "No configurado"}
              </span>
            )}
          </div>
          <input
            type="password"
            placeholder="sk-ant-api03-..."
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
          />
          <p className="text-xs text-white/30 mt-1">
            Obtén tu key en{" "}
            <span className="text-indigo-400">console.anthropic.com</span>
          </p>
        </div>

        {/* OpenAI / ChatGPT */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-white/80">ChatGPT (OpenAI)</span>
            {status && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  status.openai_configured
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {status.openai_configured
                  ? `Configurado ${status.openai_key_hint}`
                  : "No configurado"}
            </span>
            )}
          </div>
          <input
            type="password"
            placeholder="sk-proj-..."
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
          />
          <p className="text-xs text-white/30 mt-1">
            Obtén tu key en{" "}
            <span className="text-indigo-400">platform.openai.com/api-keys</span>
          </p>
        </div>

        {saved && (
          <p className="text-green-400 text-sm mb-3">Keys guardadas correctamente.</p>
        )}
        {error && (
          <p className="text-red-400 text-sm mb-3">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving || (!anthropicKey.trim() && !openaiKey.trim())}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button
            onClick={onClose}
            className="px-4 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-4 p-3 bg-white/5 rounded-lg">
          <p className="text-xs text-white/40">
            Las keys se guardan en <code className="text-white/60">backend/.env</code> de forma local. Nunca se envían a terceros.
          </p>
        </div>
      </div>
    </div>
  );
}
