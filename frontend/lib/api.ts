import type { PendingQuestions } from "@/types/agent";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function sendTask(instruction: string, crew?: string): Promise<{ task_id: string }> {
  const res = await fetch(`${API_URL}/task`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instruction, crew: crew ?? null }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchPending(): Promise<PendingQuestions[]> {
  const res = await fetch(`${API_URL}/pending`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Deliver the answers to the agents' questions. Throws Error(message) with the backend's reason. */
export async function sendAnswers(taskId: string, answers: Record<string, string>): Promise<{ folder?: string }> {
  const res = await fetch(`${API_URL}/task/${taskId}/answers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}
