export type AgentStatus = "working" | "idle" | "error" | "complete";

export interface AgentEvent {
  event_id: string;
  agent: string;
  crew: string;
  status: AgentStatus;
  task: string;
  output: string;
  model_used: string;
  timestamp: string;
}

export type CrewName = "marketing" | "frontend" | "backend" | "mobile" | "images" | "planning";
export type AgentKey = CrewName | "orchestrator";

export interface AgentState {
  crew: AgentKey;
  status: AgentStatus;
  currentTask: string;
  lastOutput: string;
  modelUsed: string;
}
