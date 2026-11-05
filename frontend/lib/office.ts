import type { AgentKey, CustomAgent } from "@/types/agent";

export const OFFICE_W = 384;
export const OFFICE_H = 256;

export interface OfficeAgent {
  key: AgentKey;
  label: string;
  role: string;
  color: string; // name-tag / shirt colour
  hair: string;
  skin: string;
  cx: number; // horizontal centre of the desk unit (logical px)
  top: number; // top of the desk unit (logical px)
  /** Set for agents created by the user: index of the lounge desk they sit at. */
  slot?: number;
}

export const BUILTIN_AGENTS: OfficeAgent[] = [
  { key: "orchestrator", label: "CEO",       role: "Dirige a todo el equipo",         color: "#f5b400", hair: "#2b2118", skin: "#f1c59b", cx: 70,  top: 54 },
  { key: "marketing",    label: "Marketing", role: "Estrategia, reels y analítica",   color: "#ef5b5b", hair: "#6b3a1e", skin: "#f1c59b", cx: 196, top: 56 },
  { key: "frontend",     label: "Frontend",  role: "Diseño UI/UX y React",            color: "#1fb5a6", hair: "#1c1c28", skin: "#d9a577", cx: 268, top: 56 },
  { key: "backend",      label: "Backend",   role: "API, base de datos e infra",      color: "#3b82f6", hair: "#4a2d18", skin: "#f1c59b", cx: 340, top: 56 },
  { key: "mobile",       label: "Mobile",    role: "Apps iOS y Android",              color: "#e6a800", hair: "#c9892b", skin: "#f6d3b0", cx: 196, top: 140 },
  { key: "images",       label: "Creativo",  role: "Diseño gráfico e imágenes",       color: "#8b5cf6", hair: "#b8321f", skin: "#f1c59b", cx: 268, top: 140 },
  { key: "planning",     label: "Plan",      role: "Gestión de proyectos y roadmap",  color: "#16a34a", hair: "#222222", skin: "#a8744f", cx: 340, top: 140 },
];

/** Desks in the lounge for the agents the user creates (same unit size as the others). */
export const CUSTOM_SLOTS = [
  { cx: 34, top: 132 },
  { cx: 98, top: 132 },
  { cx: 34, top: 190 },
  { cx: 98, top: 190 },
];
export const MAX_CUSTOM_AGENTS = CUSTOM_SLOTS.length;

const LOOKS = [
  { hair: "#3b2a1a", skin: "#f1c59b" },
  { hair: "#d9a441", skin: "#f6d3b0" },
  { hair: "#161616", skin: "#a8744f" },
  { hair: "#8a3b1e", skin: "#d9a577" },
];

export const AGENT_COLORS = ["#ef5b5b", "#f08a24", "#e6a800", "#16a34a", "#1fb5a6", "#3b82f6", "#8b5cf6", "#ec4899"];

/** Built-in agents plus the user's, each custom one at the next free lounge desk. */
export function buildAgents(custom: CustomAgent[]): OfficeAgent[] {
  return [
    ...BUILTIN_AGENTS,
    ...custom.slice(0, MAX_CUSTOM_AGENTS).map((c, i) => ({
      key: c.key,
      label: c.label,
      role: c.role,
      color: c.color,
      ...LOOKS[i % LOOKS.length],
      ...CUSTOM_SLOTS[i],
      slot: i,
    })),
  ];
}

export function agentMap(agents: OfficeAgent[]): Record<AgentKey, OfficeAgent> {
  return Object.fromEntries(agents.map((a) => [a.key, a]));
}

/** Fallback for an agent that no longer exists (e.g. it shows up in an old task). */
export const UNKNOWN_AGENT: OfficeAgent = {
  key: "?", label: "?", role: "", color: "#9ca3af", hair: "#222", skin: "#f1c59b", cx: 0, top: 0,
};
