"use client";

import { useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { sendTask } from "@/lib/api";
import { AgentsGrid } from "@/components/AgentsGrid";
import { CommandInput } from "@/components/CommandInput";
import { LiveLog } from "@/components/LiveLog";
import { StatusBar } from "@/components/StatusBar";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws";

interface HistoryEntry {
  id: string;
  instruction: string;
  ts: string;
}

export default function DashboardPage() {
  const { events, agentStates, isConnected } = useWebSocket(WS_URL);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  async function handleSubmit(instruction: string) {
    setSubmitting(true);
    try {
      const { task_id } = await sendTask(instruction);
      setHistory((prev) => [
        { id: task_id, instruction, ts: new Date().toLocaleTimeString() },
        ...prev,
      ]);
    } catch (err) {
      console.error("sendTask failed", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {/* Left sidebar */}
      <aside className="w-72 flex flex-col border-r border-white/10 shrink-0">
        <StatusBar agentStates={agentStates} isConnected={isConnected} />
        <CommandInput onSubmit={handleSubmit} disabled={submitting} />
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Historial</p>
          {history.length === 0 && (
            <p className="text-xs text-gray-600">Sin instrucciones aún.</p>
          )}
          {history.map((h) => (
            <div key={h.id} className="mb-2 text-xs border border-white/5 rounded-lg p-2 bg-white/5">
              <span className="text-gray-500 mr-1">{h.ts}</span>
              <span className="text-gray-300">{h.instruction}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Main area */}
      <main className="flex flex-col flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <AgentsGrid agentStates={agentStates} />
        </div>
        <div className="h-48 shrink-0">
          <LiveLog events={events} />
        </div>
      </main>
    </div>
  );
}
