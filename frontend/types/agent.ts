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
/** A built-in crew, "orchestrator" (the CEO) or the key of an agent the user created. */
export type AgentKey = string;

/** An agent the user created from the office (name + what it should do + colour). */
export interface CustomAgent {
  key: string;
  label: string;
  role: string;
  color: string;
}

export interface PlanItem {
  crew: string;
  task: string;
}

export interface AgentState {
  crew: AgentKey;
  status: AgentStatus;
  currentTask: string;
  lastOutput: string;
  modelUsed: string;
}

export interface Question {
  id: string;
  kind: "text" | "folder";
  question: string;
}

export interface PendingQuestions {
  task_id: string;
  instruction: string;
  questions: Question[];
  /** What the CEO plans to do, shown for approval (empty if there is nothing to approve). */
  plan?: PlanItem[];
}
