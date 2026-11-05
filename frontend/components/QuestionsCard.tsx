"use client";

import { useEffect, useRef, useState } from "react";
import FolderPicker from "@/components/FolderPicker";
import VoiceButton from "@/components/VoiceButton";
import { cancelTask, sendAnswers } from "@/lib/api";
import { agentMap, UNKNOWN_AGENT, type OfficeAgent } from "@/lib/office";
import { isApproval } from "@/lib/voice";
import type { PendingQuestions } from "@/types/agent";

interface Props {
  pending: PendingQuestions;
  agents: OfficeAgent[];
  /** Goes up each time the user says "aprobado" with the main microphone. */
  approveRequest?: number;
  onAnswered: (taskId: string) => void;
}

/**
 * The only thing asked before a new project starts: approve the plan and choose the folder.
 * Approving (button or saying "aprobado") starts the work at once; the folder is remembered.
 */
export default function QuestionsCard({ pending, agents, approveRequest = 0, onAnswered }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [heard, setHeard] = useState("");
  const [picking, setPicking] = useState(false);

  const byKey = agentMap(agents);
  const plan = pending.plan ?? [];
  const folderQ = pending.questions.find((q) => q.kind === "folder");
  const folder = folderQ ? (answers[folderQ.id] ?? "").trim() : "";
  const canApprove = !sending && (!folderQ || folder !== "");

  async function approve(withAnswers = answers) {
    if (sending) return;
    setSending(true);
    setError("");
    try {
      await sendAnswers(pending.task_id, withAnswers);
      onAnswered(pending.task_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar la aprobación.");
    } finally {
      setSending(false);
    }
  }

  async function cancel() {
    if (sending) return;
    setSending(true);
    setError("");
    try {
      await cancelTask(pending.task_id);
      onAnswered(pending.task_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cancelar la tarea.");
    } finally {
      setSending(false);
    }
  }

  function onVoice(text: string) {
    setHeard(text);
    if (isApproval(text)) approveByVoice();
  }

  function approveByVoice() {
    if (!canApprove) setError("Antes elige la carpeta del proyecto y luego di «aprobado».");
    else approve();
  }

  // "aprobado" said into the main microphone
  const approveByVoiceRef = useRef(approveByVoice);
  const lastRequest = useRef(approveRequest);
  useEffect(() => {
    approveByVoiceRef.current = approveByVoice;
    if (approveRequest !== lastRequest.current) {
      lastRequest.current = approveRequest;
      approveByVoiceRef.current();
    }
  });

  return (
    <div className="px-panel flex flex-col gap-3 border-[#f08a24] p-3" role="form" aria-label="Aprobar el plan">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-pixel border-2 border-[#3a2f2a] bg-[#f08a24] px-2 py-1.5 text-[8px] text-white">
          PLAN PARA APROBAR
        </span>
        <span className="text-xs text-[#6b5d52]">Tarea: “{pending.instruction}”</span>
      </div>

      {plan.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="Plan">
          {plan.map((item, i) => {
            const a = byKey[item.crew] ?? UNKNOWN_AGENT;
            return (
              <li key={`${item.crew}-${i}`} className="flex items-start gap-2 bg-[#faf6ee] px-2 py-1.5 text-sm">
                <span
                  className="font-pixel mt-0.5 shrink-0 border-2 border-[#3a2f2a] px-1.5 py-1 text-[7px] text-white"
                  style={{ background: a.color }}
                >
                  {a.label === "?" ? item.crew : a.label}
                </span>
                <span>{item.task}</span>
              </li>
            );
          })}
        </ul>
      )}

      {pending.questions.map((q) => (
        <label key={q.id} className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{q.question}</span>
          <div className="flex gap-2">
            <input
              value={answers[q.id] ?? ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canApprove) approve();
              }}
              placeholder={q.kind === "folder" ? "~/Documents/mi-proyecto" : "Tu respuesta"}
              className="px-input"
              spellCheck={false}
            />
            {q.kind === "folder" && (
              <button type="button" onClick={() => setPicking(true)} className="px-btn px-btn-ghost shrink-0">
                ELEGIR…
              </button>
            )}
          </div>
          {q.kind === "folder" && (
            <span className="text-xs text-[#6b5d52]">
              Te lo pregunto una sola vez: se recuerda para las siguientes tareas. Debe estar dentro de tu carpeta personal; los
              agentes crearán y editarán archivos ahí, y solo ahí.
            </span>
          )}
        </label>
      ))}

      {picking && folderQ && (
        <FolderPicker
          initialPath={answers[folderQ.id]}
          onSelect={(path) => {
            setAnswers((prev) => ({ ...prev, [folderQ.id]: path }));
            setError("");
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <div className="flex flex-wrap items-start gap-3">
        <button type="button" onClick={() => approve()} disabled={!canApprove} className="px-btn">
          {sending ? "ENVIANDO…" : "APROBAR Y EMPEZAR"}
        </button>
        <VoiceButton onFinal={onVoice} label="DI «APROBADO»" />
        <button type="button" onClick={cancel} disabled={sending} className="px-btn px-btn-ghost">
          CANCELAR TAREA
        </button>
      </div>
      {heard && <p className="text-xs text-[#6b5d52]">Escuché: “{heard}”</p>}
    </div>
  );
}
