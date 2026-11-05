"use client";

import type { AgentEvent, AgentKey, AgentState, AgentStatus } from "@/types/agent";
import { AGENTS, AGENT_BY_KEY } from "@/lib/office";

export interface HistoryEntry {
  id: string;
  target: AgentKey;
  instruction: string;
  ts: string;
  /** Task status as the backend reports it (waiting, running, complete, error, cancelled, interrupted). */
  status?: string;
}

const TASK_STATUS_LABEL: Record<string, string> = {
  waiting: "ESPERANDO RESPUESTAS",
  running: "EN CURSO",
  complete: "LISTA",
  error: "CON ERROR",
  cancelled: "CANCELADA",
  interrupted: "INTERRUMPIDA",
};

const STATUS_LABEL: Record<AgentStatus, string> = {
  working: "TRABAJANDO",
  idle: "LIBRE",
  complete: "LISTO",
  error: "ERROR",
};

const STATUS_COLOR: Record<AgentStatus, string> = {
  working: "#f08a24",
  idle: "#9ca3af",
  complete: "#22c55e",
  error: "#ef4444",
};

function Chip({ status }: { status: AgentStatus }) {
  return (
    <span
      className="font-pixel border-2 border-[#3a2f2a] px-2 py-1 text-[8px] text-white"
      style={{ background: STATUS_COLOR[status] }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

interface Props {
  agentStates: Record<AgentKey, AgentState>;
  selected: AgentKey;
  onSelect: (key: AgentKey) => void;
  events: AgentEvent[];
  history: HistoryEntry[];
}

export default function ControlPanel({ agentStates, selected, onSelect, events, history }: Props) {
  const agent = AGENT_BY_KEY[selected];
  const st = agentStates[selected];
  const recent = [...events].reverse().slice(0, 8);

  return (
    <div className="flex flex-col gap-4">
      {/* Selected agent */}
      <section className="px-panel p-3">
        <div className="flex items-center justify-between gap-2">
          <span
            className="font-pixel border-2 border-[#3a2f2a] px-2 py-1.5 text-[10px] text-white"
            style={{ background: agent.color }}
          >
            {agent.label}
          </span>
          <Chip status={st.status} />
        </div>
        <p className="mt-2 text-sm text-[#6b5d52]">{agent.role}</p>

        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="font-pixel text-[8px] text-[#9a8d80]">MODELO</dt>
            <dd className="font-mono text-xs">{st.modelUsed || "—"}</dd>
          </div>
          <div>
            <dt className="font-pixel text-[8px] text-[#9a8d80]">TAREA ACTUAL</dt>
            <dd>{st.currentTask || "Sin tarea. Escríbele abajo qué debe hacer."}</dd>
          </div>
          <div>
            <dt className="font-pixel text-[8px] text-[#9a8d80]">ÚLTIMO RESULTADO</dt>
            <dd>
              {st.lastOutput ? (
                <pre className="mt-1 max-h-44 overflow-auto whitespace-pre-wrap border-2 border-[#3a2f2a] bg-[#faf6ee] p-2 font-mono text-xs">
                  {st.lastOutput}
                </pre>
              ) : (
                <span className="text-[#9a8d80]">—</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {/* Team */}
      <section className="px-panel p-3">
        <h2 className="font-pixel mb-2 text-[10px]">EQUIPO</h2>
        <ul className="grid grid-cols-2 gap-2">
          {AGENTS.map((a) => {
            const s = agentStates[a.key].status;
            const active = a.key === selected;
            return (
              <li key={a.key}>
                <button
                  type="button"
                  onClick={() => onSelect(a.key)}
                  className="flex w-full items-center gap-2 border-2 border-[#3a2f2a] px-2 py-2 text-left transition-colors hover:bg-[#fff3e0]"
                  style={{ background: active ? "#ffe6bf" : "#fff" }}
                >
                  <span
                    className="inline-block h-3 w-3 shrink-0 border-2 border-[#3a2f2a]"
                    style={{ background: STATUS_COLOR[s] }}
                  />
                  <span className="min-w-0">
                    <span className="font-pixel block truncate text-[8px]">{a.label}</span>
                    <span className="block truncate text-[11px] text-[#6b5d52]">{STATUS_LABEL[s].toLowerCase()}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Live activity */}
      <section className="px-panel p-3">
        <h2 className="font-pixel mb-2 text-[10px]">ACTIVIDAD</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-[#9a8d80]">Todavía no hay actividad.</p>
        ) : (
          <ul className="space-y-1.5">
            {recent.map((e) => (
              <li key={e.event_id} className="border-l-4 bg-[#faf6ee] px-2 py-1 text-xs" style={{ borderColor: STATUS_COLOR[e.status] }}>
                <span className="font-mono text-[#9a8d80]">{e.timestamp.slice(11, 19)}</span>{" "}
                <b>{AGENT_BY_KEY[e.crew as AgentKey]?.label ?? e.crew}</b>{" "}
                <span className="text-[#6b5d52]">{e.agent} · {STATUS_LABEL[e.status].toLowerCase()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* History */}
      <section className="px-panel p-3">
        <h2 className="font-pixel mb-2 text-[10px]">TAREAS ENVIADAS</h2>
        {history.length === 0 ? (
          <p className="text-sm text-[#9a8d80]">Aún no has enviado tareas.</p>
        ) : (
          <ul className="space-y-1.5">
            {history.slice(0, 8).map((h) => (
              <li key={h.id} className="bg-[#faf6ee] px-2 py-1.5 text-xs">
                <span className="font-mono text-[#9a8d80]">{h.ts}</span>{" "}
                <b style={{ color: AGENT_BY_KEY[h.target].color }}>{AGENT_BY_KEY[h.target].label}</b>
                {h.status && TASK_STATUS_LABEL[h.status] && (
                  <span className="font-pixel ml-2 text-[7px] text-[#6b5d52]">{TASK_STATUS_LABEL[h.status]}</span>
                )}
                <div className="text-[#4a3f38]">{h.instruction}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
