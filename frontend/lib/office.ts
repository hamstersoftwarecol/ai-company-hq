import type { AgentKey } from "@/types/agent";

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
}

export const AGENTS: OfficeAgent[] = [
  { key: "orchestrator", label: "CEO",       role: "Dirige a todo el equipo",         color: "#f5b400", hair: "#2b2118", skin: "#f1c59b", cx: 70,  top: 54 },
  { key: "marketing",    label: "Marketing", role: "Estrategia, reels y analítica",   color: "#ef5b5b", hair: "#6b3a1e", skin: "#f1c59b", cx: 196, top: 56 },
  { key: "frontend",     label: "Frontend",  role: "Diseño UI/UX y React",            color: "#1fb5a6", hair: "#1c1c28", skin: "#d9a577", cx: 268, top: 56 },
  { key: "backend",      label: "Backend",   role: "API, base de datos e infra",      color: "#3b82f6", hair: "#4a2d18", skin: "#f1c59b", cx: 340, top: 56 },
  { key: "mobile",       label: "Mobile",    role: "Apps iOS y Android",              color: "#e6a800", hair: "#c9892b", skin: "#f6d3b0", cx: 196, top: 140 },
  { key: "images",       label: "Creativo",  role: "Diseño gráfico e imágenes",       color: "#8b5cf6", hair: "#b8321f", skin: "#f1c59b", cx: 268, top: 140 },
  { key: "planning",     label: "Plan",      role: "Gestión de proyectos y roadmap",  color: "#16a34a", hair: "#222222", skin: "#a8744f", cx: 340, top: 140 },
];

export const AGENT_BY_KEY = Object.fromEntries(AGENTS.map((a) => [a.key, a])) as Record<AgentKey, OfficeAgent>;
