const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function sendTask(instruction: string): Promise<{ task_id: string }> {
  const res = await fetch(`${API_URL}/task`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instruction }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
