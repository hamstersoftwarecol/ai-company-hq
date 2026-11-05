"use client";

import { useState } from "react";
import FolderPicker from "@/components/FolderPicker";
import { cancelTask, sendAnswers } from "@/lib/api";
import type { PendingQuestions } from "@/types/agent";

interface Props {
  pending: PendingQuestions;
  onAnswered: (taskId: string) => void;
}

/** The CEO's questions before starting: clarifications plus the project folder. */
export default function QuestionsCard({ pending, onAnswered }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);

  const folderQ = pending.questions.find((q) => q.kind === "folder");
  const canSend = !sending && (!folderQ || (answers[folderQ.id] ?? "").trim() !== "");

  async function submit() {
    if (!canSend) return;
    setSending(true);
    setError("");
    try {
      await sendAnswers(pending.task_id, answers);
      onAnswered(pending.task_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar las respuestas.");
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

  return (
    <div className="px-panel flex flex-col gap-3 border-[#f08a24] p-3" role="form" aria-label="Preguntas antes de empezar">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-pixel border-2 border-[#3a2f2a] bg-[#f08a24] px-2 py-1.5 text-[8px] text-white">
          ANTES DE EMPEZAR
        </span>
        <span className="text-xs text-[#6b5d52]">Tarea: “{pending.instruction}”</span>
      </div>

      {pending.questions.map((q) => (
        <label key={q.id} className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{q.question}</span>
          <div className="flex gap-2">
            <input
              value={answers[q.id] ?? ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
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
              Usa ELEGIR… para explorar tus carpetas o crear una nueva, o escribe la ruta. Debe estar dentro de tu carpeta personal; los agentes crearán y editarán archivos ahí, y solo ahí.
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
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={submit} disabled={!canSend} className="px-btn">
          {sending ? "ENVIANDO…" : "RESPONDER Y EMPEZAR"}
        </button>
        <button type="button" onClick={cancel} disabled={sending} className="px-btn px-btn-ghost">
          CANCELAR TAREA
        </button>
      </div>
    </div>
  );
}
