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

export interface FolderListing {
  path: string;
  home: string;
  parent: string | null;
  folders: { name: string; path: string }[];
}

async function failWith(res: Response): Promise<never> {
  let detail = `HTTP ${res.status}`;
  try {
    detail = (await res.json()).detail ?? detail;
  } catch {}
  throw new Error(detail);
}

/** Sub-folders of `path` (default: the user's home) for the folder picker. */
export async function listFolders(path?: string): Promise<FolderListing> {
  const res = await fetch(`${API_URL}/folders${path ? `?path=${encodeURIComponent(path)}` : ""}`);
  if (!res.ok) return failWith(res);
  return res.json();
}

/** Create `name` inside `parent` and return its absolute path. */
export async function createFolder(parent: string, name: string): Promise<{ path: string }> {
  const res = await fetch(`${API_URL}/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parent, name }),
  });
  if (!res.ok) return failWith(res);
  return res.json();
}
