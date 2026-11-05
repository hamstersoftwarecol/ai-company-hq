"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { sendTask } from "@/lib/api";
import { AGENT_BY_KEY } from "@/lib/office";
import type { AgentKey } from "@/types/agent";
import ControlPanel, { type HistoryEntry } from "@/components/ControlPanel";
import SettingsPanel from "@/components/SettingsPanel";

const PixelOffice = dynamic(() => import("@/components/PixelOffice"), { ssr: false });

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws";

export default function OfficePage() {
  const { events, agentStates, isConnected } = useWebSocket(WS_URL);
  const [selected, setSelected] = useState<AgentKey>("orchestrator");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  const target = AGENT_BY_KEY[selected];
  const working = Object.values(agentStates).filter((s) => s.status === "working").length;

  async function handleSend() {
    const instruction = text.trim();
    if (!instruction || sending) return;
    setSending(true);
    setError("");
    try {
      const { task_id } = await sendTask(instruction, selected === "orchestrator" ? undefined : selected);
      setHistory((prev) => [
        { id: task_id, target: selected, instruction, ts: new Date().toLocaleTimeString() },
        ...prev,
      ]);
      setText("");
    } catch {
      setError("No se pudo enviar. ¿Está el backend encendido en el puerto 8000?");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen">
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      <header className="flex flex-wrap items-center gap-3 border-b-[3px] border-[#3a2f2a] bg-[#ffcf6b] px-4 py-3">
        <h1 className="font-pixel text-[11px] leading-snug sm:text-sm">MI OFICINA VIRTUAL</h1>
        <span
          className="font-pixel inline-flex items-center gap-2 border-2 border-[#3a2f2a] bg-white px-2 py-1.5 text-[8px]"
          title={isConnected ? "Conectado al backend" : "Sin conexión con el backend"}
        >
          <span
            className="inline-block h-2.5 w-2.5 border border-[#3a2f2a]"
            style={{ background: isConnected ? "#22c55e" : "#ef4444" }}
          />
          {isConnected ? "CONECTADO" : "SIN CONEXIÓN"}
        </span>
        {working > 0 && (
          <span className="font-pixel border-2 border-[#3a2f2a] bg-[#f08a24] px-2 py-1.5 text-[8px] text-white">
            {working} TRABAJANDO
          </span>
        )}
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="px-btn px-btn-ghost ml-auto"
        >
          AJUSTES
        </button>
      </header>

      <main className="mx-auto grid max-w-[1400px] gap-5 p-3 sm:p-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="flex min-w-0 flex-col gap-4">
          <div className="px-panel p-2">
            <PixelOffice agentStates={agentStates} selected={selected} onSelect={setSelected} />
          </div>

          {/* Command bar */}
          <div className="px-panel flex flex-col gap-3 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-pixel text-[9px]">PARA:</span>
              <span
                className="font-pixel border-2 border-[#3a2f2a] px-2 py-1.5 text-[9px] text-white"
                style={{ background: target.color }}
              >
                {target.label}
              </span>
              <span className="text-xs text-[#6b5d52]">
                {selected === "orchestrator"
                  ? "El CEO decide qué equipos hacen falta y les reparte el trabajo."
                  : "Se lo asignas directo a este agente. Cambia de agente haciendo clic en la oficina."}
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend();
                }}
                placeholder={`¿Qué debe hacer ${target.label}?`}
                className="px-input"
                aria-label="Instrucción para el agente"
              />
              <button type="button" onClick={handleSend} disabled={sending || !text.trim()} className="px-btn shrink-0">
                {sending ? "ENVIANDO…" : "ENVIAR"}
              </button>
            </div>
            {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          </div>
        </section>

        <aside className="min-w-0">
          <ControlPanel
            agentStates={agentStates}
            selected={selected}
            onSelect={setSelected}
            events={events}
            history={history}
          />
        </aside>
      </main>
    </div>
  );
}
