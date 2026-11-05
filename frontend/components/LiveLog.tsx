"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentEvent, CrewName } from "@/types/agent";

const CREWS: Array<"all" | CrewName> = ["all", "marketing", "frontend", "backend", "mobile", "images", "planning"];

interface Props {
  events: AgentEvent[];
}

export function LiveLog({ events }: Props) {
  const [filter, setFilter] = useState<"all" | CrewName>("all");
  const bottomRef = useRef<HTMLDivElement>(null);

  const filtered = filter === "all" ? events : events.filter((e) => e.crew === filter);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [filtered.length]);

  return (
    <div className="flex flex-col h-full border-t border-white/10">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
        <span className="text-xs font-medium text-gray-400">Log</span>
        <select
          className="ml-auto text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-gray-300"
          value={filter}
          onChange={(e) => setFilter(e.target.value as "all" | CrewName)}
        >
          {CREWS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-xs px-4 py-2 space-y-0.5">
        {filtered.map((e) => {
          const ts = new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
          return (
            <div key={e.event_id} className="flex gap-2 text-gray-400">
              <span className="text-gray-600 shrink-0">[{ts}]</span>
              <span className="text-indigo-400 shrink-0">{e.crew}/{e.agent}</span>
              <span className="truncate">{e.output || e.task}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
