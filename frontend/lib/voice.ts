/** Pure helpers to turn what the user says into a task. No browser APIs, so they are easy to test. */

export interface VoiceAgent {
  key: string;
  label: string;
}

export interface VoiceCommand {
  /** Agent the user addressed ("dile al backend ..."), or null if none was named. */
  target: string | null;
  /** The instruction, without the addressing and without a trailing "enviar". */
  text: string;
  /** The user ended with "enviar" / "envíalo": send it without pressing anything. */
  send: boolean;
}

// How people say each built-in agent (already without accents, lower case).
const ALIASES: Record<string, string[]> = {
  orchestrator: ["ceo", "jefe", "director"],
  marketing: ["marketing", "mercadeo", "mercadotecnia"],
  frontend: ["frontend", "front end", "front-end", "interfaz"],
  backend: ["backend", "back end", "back-end", "servidor"],
  mobile: ["mobile", "movil", "moviles"],
  images: ["creativo", "imagenes", "diseno grafico"],
  planning: ["planning", "plan", "planeacion", "planificacion"],
};

// Words people put before the agent's name: "dile al backend que ...", "para el equipo de marketing ..."
const FILLER = new Set(["dile", "diles", "digale", "pidele", "pideles", "para", "al", "a", "la", "el", "equipo", "de", "que"]);

/** Lower case and strip accents, one character for one character (so indexes still match the original). */
export function fold(s: string): string {
  return Array.from(s)
    .map((ch) => ch.normalize("NFD")[0].toLowerCase())
    .join("");
}

function aliasesFor(agent: VoiceAgent): string[] {
  return [...(ALIASES[agent.key] ?? []), fold(agent.label).trim(), fold(agent.key)].filter(Boolean);
}

function startsWithWord(text: string, alias: string): boolean {
  if (!text.startsWith(alias)) return false;
  const next = text[alias.length];
  return next === undefined || !/[a-z0-9]/.test(next);
}

const SEND_RE = /[\s,.;:-]*\b(enviar|envialo|mandalo|ejecutalo)\s*[.!]?\s*$/;

export function parseVoiceCommand(transcript: string, agents: VoiceAgent[]): VoiceCommand {
  let original = transcript.trim();
  let send = false;

  const tail = SEND_RE.exec(fold(original));
  if (tail && tail.index > 0) {
    original = original.slice(0, tail.index).trim();
    send = true;
  }

  // Look for the agent's name at the start, skipping filler words ("dile al ...").
  let offset = 0;
  let target: string | null = null;
  for (let skipped = 0; skipped < 5 && target === null; skipped++) {
    const folded = fold(original.slice(offset));
    const lead = folded.length - folded.trimStart().length;
    const rest = folded.slice(lead);
    let best: { key: string; len: number } | null = null;
    for (const agent of agents) {
      for (const alias of aliasesFor(agent)) {
        if (startsWithWord(rest, alias) && (!best || alias.length > best.len)) best = { key: agent.key, len: alias.length };
      }
    }
    if (best) {
      target = best.key;
      offset += lead + best.len;
      break;
    }
    const word = /^[a-z]+/.exec(rest);
    if (!word || !FILLER.has(word[0])) break;
    offset += lead + word[0].length;
  }

  let text = target ? original.slice(offset) : original;
  if (target) text = text.replace(/^[\s,:;.-]+/, "").replace(/^que\b[\s,:;.-]*/i, "");
  return { target, text: text.trim(), send };
}

/** True if the user is approving a plan: "aprobado", "apruebo", "adelante", "dale", "empieza"... */
export function isApproval(transcript: string): boolean {
  return /^\s*(?:(?:si|ok|okay|vale|listo)[\s,]+)?(aprobado|aprobada|apruebo|aprobar|adelante|dale|empieza|comienza|arranca)\b/.test(
    fold(transcript)
  );
}
