"use client";

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface KeyStatus {
  anthropic_configured: boolean;
  openai_configured: boolean;
  anthropic_key_hint: string;
  openai_key_hint: string;
}

function Badge({ ok, hint }: { ok: boolean; hint: string }) {
  return (
    <span
      className="font-pixel border-2 border-[#3a2f2a] px-2 py-1 text-[8px] text-white"
      style={{ background: ok ? "#22c55e" : "#ef4444" }}
    >
      {ok ? `OK ${hint}` : "FALTA"}
    </span>
  );
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3a2f2a]/40 p-4">
      <div className="px-panel w-full max-w-md p-5">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-pixel text-[11px]">AJUSTES DE API</h2>
          <button onClick={onClose} className="px-btn px-btn-ghost" aria-label="Cerrar">
            X
          </button>
        </div>

        <div className="mb-4">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-sm font-semibold">Claude (Anthropic)</span>
            {status && <Badge ok={status.anthropic_configured} hint={status.anthropic_key_hint} />}
          </div>
          <input
            type="password"
            placeholder="sk-ant-api03-..."
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            className="px-input"
          />
          <p className="mt-1 text-xs text-[#6b5d52]">
            Obtén tu key en <span className="font-semibold text-[#c96a10]">console.anthropic.com</span>
          </p>
        </div>

        <div className="mb-5">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-sm font-semibold">ChatGPT (OpenAI)</span>
            {status && <Badge ok={status.openai_configured} hint={status.openai_key_hint} />}
          </div>
          <input
            type="password"
            placeholder="sk-proj-..."
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            className="px-input"
          />
          <p className="mt-1 text-xs text-[#6b5d52]">
            Obtén tu key en <span className="font-semibold text-[#c96a10]">platform.openai.com/api-keys</span>
          </p>
        </div>

        {saved && <p className="mb-3 text-sm font-medium text-green-700">Keys guardadas correctamente.</p>}
        {error && <p className="mb-3 text-sm font-medium text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving || (!anthropicKey.trim() && !openaiKey.trim())}
            className="px-btn flex-1"
          >
            {saving ? "GUARDANDO…" : "GUARDAR"}
          </button>
          <button onClick={onClose} className="px-btn px-btn-ghost">
            CERRAR
          </button>
        </div>

        <p className="mt-4 border-2 border-dashed border-[#3a2f2a]/40 bg-[#faf6ee] p-2.5 text-xs text-[#6b5d52]">
          Las keys se guardan en <code className="font-mono">backend/.env</code> de forma local. Nunca se envían a terceros.
        </p>
      </div>
    </div>
  );
}
