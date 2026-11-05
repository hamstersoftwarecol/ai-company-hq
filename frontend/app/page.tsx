"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  clearProject, deleteCustomAgent, fetchHistory, getProject, listCustomAgents, sendTask, setProject,
} from "@/lib/api";
import { agentMap, buildAgents, UNKNOWN_AGENT } from "@/lib/office";
import { isApproval, parseVoiceCommand } from "@/lib/voice";
import type { AgentKey, CustomAgent } from "@/types/agent";
import AgentForm from "@/components/AgentForm";
import ControlPanel, { type HistoryEntry } from "@/components/ControlPanel";
import FolderPicker from "@/components/FolderPicker";
import QuestionsCard from "@/components/QuestionsCard";
import VoiceButton from "@/components/VoiceButton";

const PixelOffice = dynamic(() => import("@/components/PixelOffice"), { ssr: false });

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws";

export default function OfficePage() {
  const [customAgents, setCustomAgents] = useState<CustomAgent[]>([]);
  const agents = useMemo(() => buildAgents(customAgents), [customAgents]);
  const byKey = useMemo(() => agentMap(agents), [agents]);

  const { events, agentStates, isConnected, pending, dismissPending } = useWebSocket(
    WS_URL,
    customAgents.map((a) => a.key)
  );
  const [selected, setSelected] = useState<AgentKey>("orchestrator");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [project, setProjectFolder] = useState<string | null>(null);
  const [autoSend, setAutoSend] = useState(false);
  const [approveRequest, setApproveRequest] = useState(0);
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [pickingProject, setPickingProject] = useState(false);

  const target = byKey[selected] ?? UNKNOWN_AGENT;
  const working = Object.values(agentStates).filter((s) => s.status === "working").length;

  // The backend remembers the tasks (even across restarts): show what it reports.
  const refreshHistory = useCallback(() => {
    fetchHistory()
      .then((tasks) =>
        setHistory(
          tasks
            .slice(-20)
            .reverse()
            .map((t) => ({
              id: t.task_id,
              target: (t.crew ?? "orchestrator") as AgentKey,
              instruction: t.instruction,
              ts: t.created_at ? new Date(t.created_at).toLocaleTimeString() : "",
              status: t.status,
            }))
        )
      )
      .catch(() => {});
  }, []);

  const refreshProject = useCallback(() => {
    getProject()
      .then(setProjectFolder)
      .catch(() => {});
  }, []);

  useEffect(() => {
    listCustomAgents()
      .then(setCustomAgents)
      .catch(() => {});
  }, [isConnected]);

  // On load, when the connection comes back, and (debounced) as agents report progress.
  useEffect(() => {
    const timer = setTimeout(() => {
      refreshHistory();
      refreshProject();
    }, 400);
    return () => clearTimeout(timer);
  }, [refreshHistory, refreshProject, isConnected, events.length, pending.length]);

  async function send(instruction: string, to: AgentKey) {
    if (!instruction.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      await sendTask(instruction.trim(), to === "orchestrator" ? undefined : to);
      refreshHistory();
      setText("");
    } catch {
      setError("No se pudo enviar. ¿Está el backend encendido en el puerto 8000?");
    } finally {
      setSending(false);
    }
  }

  /** What the user said: "backend crea la API, envíalo" picks the agent, fills the text, maybe sends. */
  function onVoice(transcript: string) {
    if (pending.length > 0 && isApproval(transcript)) {
      setApproveRequest((n) => n + 1); // "aprobado" approves the plan that is waiting
      return;
    }
    const cmd = parseVoiceCommand(transcript, agents);
    const to = cmd.target ?? selected;
    if (cmd.target) setSelected(cmd.target);
    setText(cmd.text);
    if ((cmd.send || autoSend) && cmd.text) void send(cmd.text, to);
  }

  async function handleCreated(agent: CustomAgent) {
    setCustomAgents((prev) => [...prev, agent]);
    setSelected(agent.key);
    setShowAgentForm(false);
  }

  async function handleDeleteAgent(key: AgentKey) {
    try {
      await deleteCustomAgent(key);
      setCustomAgents((prev) => prev.filter((a) => a.key !== key));
      if (selected === key) setSelected("orchestrator");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo borrar el agente.");
    }
  }

  return (
    <div className="min-h-screen">
      {showAgentForm && <AgentForm onCreated={handleCreated} onClose={() => setShowAgentForm(false)} />}
      {pickingProject && (
        <FolderPicker
          initialPath={project ?? undefined}
          onSelect={async (path) => {
            setPickingProject(false);
            try {
              setProjectFolder(await setProject(path));
            } catch (e) {
              setError(e instanceof Error ? e.message : "No se pudo cambiar la carpeta.");
            }
          }}
          onClose={() => setPickingProject(false)}
        />
      )}

      <header className="flex flex-wrap items-center gap-3 border-b-[3px] border-[#3a2f2a] bg-[#ffcf6b] px-4 py-3">
        <h1 className="font-pixel text-[11px] leading-snug sm:text-sm">MI OFICINA VIRTUAL HAMSTER SOFTWARE</h1>
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
      </header>

      <main className="mx-auto grid max-w-[1400px] gap-5 p-3 sm:p-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="flex min-w-0 flex-col gap-4">
          {/* Project folder: asked once, then remembered */}
          <div className="px-panel flex flex-wrap items-center gap-2 p-3">
            <span className="font-pixel text-[9px]">PROYECTO:</span>
            {project ? (
              <code className="min-w-0 flex-1 truncate border-2 border-[#3a2f2a] bg-[#faf6ee] px-2 py-1.5 text-xs" title={project}>
                {project}
              </code>
            ) : (
              <span className="min-w-0 flex-1 text-xs text-[#6b5d52]">
                Aún no hay. Al aprobar el primer plan te pido la carpeta, una sola vez.
              </span>
            )}
            <button type="button" className="px-btn px-btn-ghost shrink-0" onClick={() => setPickingProject(true)}>
              {project ? "CAMBIAR" : "ELEGIR CARPETA"}
            </button>
            {project && (
              <button
                type="button"
                className="px-btn px-btn-ghost shrink-0"
                onClick={async () => {
                  if (!window.confirm("¿Empezar un proyecto nuevo? La próxima tarea mostrará un plan para aprobar y te pedirá la carpeta.")) return;
                  try {
                    await clearProject();
                    setProjectFolder(null);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "No se pudo cambiar de proyecto.");
                  }
                }}
              >
                PROYECTO NUEVO
              </button>
            )}
          </div>

          <div className="px-panel p-2">
            <PixelOffice agents={agents} agentStates={agentStates} selected={selected} onSelect={setSelected} />
          </div>

          {pending.length > 0 && (
            <QuestionsCard
              key={pending[0].task_id}
              pending={pending[0]}
              agents={agents}
              approveRequest={approveRequest}
              onAnswered={dismissPending}
            />
          )}

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
                  if (e.key === "Enter") void send(text, selected);
                }}
                placeholder={`¿Qué debe hacer ${target.label}?`}
                className="px-input"
                aria-label="Instrucción para el agente"
              />
              <VoiceButton onFinal={onVoice} onInterim={setText} />
              <button type="button" onClick={() => void send(text, selected)} disabled={sending || !text.trim()} className="px-btn shrink-0">
                {sending ? "ENVIANDO…" : "ENVIAR"}
              </button>
            </div>
            <label className="flex items-center gap-2 text-xs text-[#6b5d52]">
              <input type="checkbox" checked={autoSend} onChange={(e) => setAutoSend(e.target.checked)} />
              Enviar solo al terminar de hablar. Tip: di «backend, crea la API» o termina con «envíalo».
            </label>
            {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          </div>
        </section>

        <aside className="min-w-0">
          <ControlPanel
            agents={agents}
            agentStates={agentStates}
            selected={selected}
            onSelect={setSelected}
            events={events}
            history={history}
            onNewAgent={() => setShowAgentForm(true)}
            onDeleteAgent={handleDeleteAgent}
          />
        </aside>
      </main>
    </div>
  );
}
