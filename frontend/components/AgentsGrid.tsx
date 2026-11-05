"use client";

import type { AgentState, CrewName } from "@/types/agent";
import { AgentCard } from "./AgentCard";

const CREWS: CrewName[] = ["marketing", "frontend", "backend", "mobile", "images", "planning"];

const DEFAULT_STATE = (crew: CrewName): AgentState => ({
  crew, status: "idle", currentTask: "", lastOutput: "", modelUsed: "",
});

interface Props {
  agentStates: Record<CrewName, AgentState>;
}

export function AgentsGrid({ agentStates }: Props) {
  return (
    <div className="grid grid-cols-3 gap-4 p-4">
      {CREWS.map((crew) => (
        <AgentCard
          key={crew}
          crew={crew}
          state={agentStates[crew] ?? DEFAULT_STATE(crew)}
        />
      ))}
    </div>
  );
}
