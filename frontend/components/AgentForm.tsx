"use client";

import { useEffect, useState } from "react";
import VoiceButton from "@/components/VoiceButton";
import { createCustomAgent } from "@/lib/api";
import { AGENT_COLORS } from "@/lib/office";
import type { CustomAgent } from "@/types/agent";

interface Props {
  onCreated: (agent: CustomAgent) => void;
  onClose: () => void;
}

/** Create an agent: a name, what it should do (it can be dictated) and a colour. It gets its own desk. */
export default function AgentForm({ onCreated, onClose }: Props) {
  const [label, setLabel] = useState("");
  const [role, setRole] = useState("");
  const [color, setColor] = useState(AGENT_COLORS[7]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const valid = label.trim().length > 0 && role.trim().length >= 5;

  async function submit() {
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      onCreated(await createCustomAgent({ label: label.trim(), role: role.trim(), color }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el agente.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3a2f2a]/40 p-4" role="dialog" aria-label="Nuevo agente">
      <div className="px-panel flex max-h-[92vh] w-full max-w-md flex-col gap-3 overflow-y-auto p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-pixel text-[11px]">NUEVO AGENTE</h2>
          <button type="button" onClick={onClose} className="px-btn px-btn-ghost" aria-label="Cerrar">
            X
          </button>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">Nombre</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={20}
            placeholder="Legal, Ventas, Soporte…"
            className="px-input"
            autoFocus
          />
        </label>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="agent-role" className="text-sm font-semibold">
              ¿Qué debe hacer?
            </label>
            <VoiceButton onFinal={(t) => setRole((prev) => (prev ? `${prev} ${t}` : t))} label="DICTAR" />
          </div>
          <textarea
            id="agent-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Eres abogado de startups. Revisas contratos y términos de uso y señalas los riesgos."
            className="px-input resize-y"
          />
        </div>

        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-semibold">Color</legend>
          <div className="flex flex-wrap gap-2">
            {AGENT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
                className="h-8 w-8 border-2 border-[#3a2f2a]"
                style={{ background: c, outline: color === c ? "3px solid #3a2f2a" : "none", outlineOffset: 2 }}
              />
            ))}
          </div>
        </fieldset>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={submit} disabled={!valid || saving} className="px-btn flex-1">
            {saving ? "CREANDO…" : "CREAR AGENTE"}
          </button>
          <button type="button" onClick={onClose} className="px-btn px-btn-ghost">
            CANCELAR
          </button>
        </div>
        <p className="text-xs text-[#6b5d52]">Se sentará en un escritorio nuevo de la oficina. Podrás darle tareas y el CEO también podrá encargarle trabajo.</p>
      </div>
    </div>
  );
}
