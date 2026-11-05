"use client";

import type { AgentState, CrewName } from "@/types/agent";

const STATUS_DOT: Record<string, string> = {
  working:  "bg-green-400 animate-pulse",
  idle:     "bg-gray-400",
  error:    "bg-red-500",
  complete: "bg-blue-400",
};

const CREW_LABEL: Record<CrewName, string> = {
  marketing: "Marketing",
  frontend:  "Frontend",
  backend:   "Backend",
  mobile:    "Mobile",
  images:    "Images",
  planning:  "Planning",
};

interface Props {
  crew: CrewName;
  state: AgentState;
}

export function AgentCard({ crew, state }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[state.status] ?? STATUS_DOT.idle}`} />
        <span className="font-semibold text-sm">{CREW_LABEL[crew]}</span>
        <span className="ml-auto text-xs text-gray-400 capitalize">{state.status}</span>
      </div>
      {state.modelUsed && (
        <span className="text-xs text-indigo-400 truncate">{state.modelUsed}</span>
      )}
      {state.currentTask && (
        <p className="text-xs text-gray-300 line-clamp-2">{state.currentTask}</p>
      )}
      {state.lastOutput && (
        <p className="text-xs text-gray-500 line-clamp-3 border-t border-white/5 pt-2">
          {state.lastOutput.slice(0, 100)}{state.lastOutput.length > 100 ? "…" : ""}
        </p>
      )}
    </div>
  );
}
