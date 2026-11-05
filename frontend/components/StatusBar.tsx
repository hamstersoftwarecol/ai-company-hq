"use client";

import Link from "next/link";
import type { AgentState, CrewName } from "@/types/agent";

interface Props {
  agentStates: Record<CrewName, AgentState>;
  isConnected: boolean;
}

export function StatusBar({ agentStates, isConnected }: Props) {
  const activeCount = Object.values(agentStates).filter((s) => s.status === "working").length;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
      <span className="font-semibold text-sm">AI Company HQ</span>
      <span className="text-xs text-gray-400">
        {activeCount > 0 ? `${activeCount} agente${activeCount > 1 ? "s" : ""} activo${activeCount > 1 ? "s" : ""}` : "Todos idle"}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/office"
          className="text-xs px-2 py-0.5 rounded border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/20 transition-colors"
          title="Entrar a la oficina pixel art"
        >
          🕹️ Oficina
        </Link>
        <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-400" : "bg-red-500"}`} />
        <span className="text-xs text-gray-400">{isConnected ? "Conectado" : "Desconectado"}</span>
      </div>
    </div>
  );
}
