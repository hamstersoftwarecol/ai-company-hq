"use client";

import { useEffect, useRef } from "react";
import type { AgentKey, AgentState, AgentStatus } from "@/types/agent";
import { AGENTS, OFFICE_H, OFFICE_W, type OfficeAgent } from "@/lib/office";

// ── Light "game" palette ───────────────────────────────────────────────────
const P = {
  floorA: "#efeff3",
  floorB: "#e3e3ea",
  carpetA: "#f3ead6",
  carpetB: "#ebdfc3",
  wall: "#f7f2e8",
  wallTrim: "#d8ccb6",
  orange: "#f08a24",
  orangeTop: "#ffb454",
  orangeDark: "#c96a10",
  desk: "#9a7260",
  deskTop: "#b8917b",
  deskFront: "#7a5848",
  outline: "#3a2f2a",
  monitor: "#2f3340",
  chair: "#6b7280",
  yellow: "#f7d51d",
  yellowDark: "#d9b50c",
  green: "#2f9e57",
  plant: "#4cc36d",
  plantDark: "#2f8f4e",
  pot: "#c8754b",
  potDark: "#a85c38",
  metal: "#b9c6d4",
  metalDark: "#7d8da0",
  white: "#ffffff",
};

type Ctx = CanvasRenderingContext2D;

function R(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function box(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string, edge = P.outline) {
  R(ctx, x, y, w, h, edge);
  R(ctx, x + 1, y + 1, w - 2, h - 2, fill);
}

// ── Decor ──────────────────────────────────────────────────────────────────
function plant(ctx: Ctx, x: number, y: number) {
  box(ctx, x + 2, y + 10, 8, 7, P.pot, P.potDark);
  R(ctx, x, y + 3, 12, 8, P.plantDark);
  R(ctx, x + 1, y + 1, 10, 7, P.plant);
  R(ctx, x + 3, y - 2, 6, 5, P.plant);
}

function fileCabinet(ctx: Ctx, x: number, y: number) {
  box(ctx, x, y, 16, 26, P.metal, P.metalDark);
  for (let i = 0; i < 3; i++) {
    R(ctx, x + 2, y + 2 + i * 8, 12, 6, "#c9d4e0");
    R(ctx, x + 6, y + 4 + i * 8, 4, 2, "#f2c230");
  }
}

function windowPane(ctx: Ctx, x: number, y: number, w: number, h: number) {
  box(ctx, x, y, w, h, "#bfe3ff", "#8aa2b8");
  R(ctx, x + w / 2 - 1, y + 1, 2, h - 2, "#8aa2b8");
  R(ctx, x + 1, y + h / 2 - 1, w - 2, 2, "#8aa2b8");
  R(ctx, x + 3, y + 3, 4, 2, "#ffffff");
}

function snackMachine(ctx: Ctx, x: number, y: number) {
  box(ctx, x, y, 26, 32, "#e04646", "#8f1f1f");
  R(ctx, x + 3, y + 3, 14, 20, "#2a2f3a");
  const cols = ["#ffd166", "#06d6a0", "#ef476f", "#118ab2", "#ffffff"];
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 3; c++) R(ctx, x + 4 + c * 4.5, y + 4 + r * 5, 3, 3, cols[(r + c) % cols.length]);
  R(ctx, x + 19, y + 5, 4, 8, "#8f1f1f");
  R(ctx, x + 4, y + 26, 18, 3, "#8f1f1f");
}

function cooler(ctx: Ctx, x: number, y: number) {
  box(ctx, x + 1, y + 10, 12, 14, P.white, P.metalDark);
  box(ctx, x + 3, y, 8, 11, "#8ccbf7", "#4a8fc2");
  R(ctx, x + 5, y + 16, 4, 2, "#4a8fc2");
}

function counter(ctx: Ctx, x: number, y: number, w: number) {
  box(ctx, x, y, w, 16, P.white, P.metalDark);
  R(ctx, x + w / 2, y + 2, 1, 12, P.metalDark);
  R(ctx, x + 4, y + 5, 8, 2, "#cfd8e3");
  R(ctx, x + w / 2 + 4, y + 5, 8, 2, "#cfd8e3");
}

function sofa(ctx: Ctx, x: number, y: number, w: number, h: number) {
  box(ctx, x, y, w, h, P.yellow, P.yellowDark);
  R(ctx, x + 2, y + 2, w - 4, 4, P.yellowDark);
  const n = Math.floor(w / 18);
  for (let i = 1; i < n; i++) R(ctx, x + (w / n) * i, y + 6, 1, h - 8, P.yellowDark);
}

function pingPong(ctx: Ctx, x: number, y: number, t: number) {
  R(ctx, x + 3, y + 28, 3, 6, P.outline);
  R(ctx, x + 42, y + 28, 3, 6, P.outline);
  box(ctx, x, y, 48, 30, P.green, "#1c6b3a");
  R(ctx, x + 2, y + 2, 44, 26, "#35b566");
  R(ctx, x + 23, y + 1, 2, 28, P.white);
  R(ctx, x + 2, y + 14, 44, 1, "rgba(255,255,255,0.7)");
  const bx = 8 + ((Math.sin(t * 2.2) + 1) / 2) * 30;
  R(ctx, x + bx, y + 12 + Math.sin(t * 4.4) * 3, 3, 3, "#fff");
}

function bookshelf(ctx: Ctx, x: number, y: number) {
  box(ctx, x, y, 24, 30, "#a8714a", "#6e4527");
  const cols = ["#ef5b5b", "#3b82f6", "#16a34a", "#f5b400", "#8b5cf6", "#1fb5a6"];
  for (let s = 0; s < 3; s++) {
    R(ctx, x + 2, y + 9 + s * 9, 20, 1, "#6e4527");
    for (let b = 0; b < 6; b++) R(ctx, x + 3 + b * 3, y + 2 + s * 9, 2, 6, cols[(b + s) % cols.length]);
  }
}

function poster(ctx: Ctx, x: number, y: number, c: string) {
  box(ctx, x, y, 14, 18, P.white, P.outline);
  R(ctx, x + 2, y + 2, 10, 8, c);
  R(ctx, x + 2, y + 12, 10, 1, "#9ca3af");
  R(ctx, x + 2, y + 14, 6, 1, "#9ca3af");
}

function orangeH(ctx: Ctx, x: number, y: number, w: number) {
  R(ctx, x, y, w, 6, P.orange);
  R(ctx, x, y, w, 2, P.orangeTop);
  R(ctx, x, y + 6, w, 2, "rgba(0,0,0,0.08)");
}
function orangeV(ctx: Ctx, x: number, y: number, h: number) {
  R(ctx, x, y, 5, h, P.orange);
  R(ctx, x, y, 2, h, P.orangeTop);
  R(ctx, x + 5, y, 2, h, "rgba(0,0,0,0.08)");
}

function meetingRoom(ctx: Ctx, t: number) {
  const x = 164, y = 214, w = 196, h = 28;
  for (let i = 0; i < 5; i++) {
    box(ctx, x + 14 + i * 36, y - 9, 14, 9, P.chair, "#4b5563");
    box(ctx, x + 14 + i * 36, y + h, 14, 9, P.chair, "#4b5563");
  }
  box(ctx, x, y, w, h, "#c9a088", P.deskFront);
  R(ctx, x + 3, y + 3, w - 6, 2, "#d9b8a3");
  for (let i = 0; i < 4; i++) {
    R(ctx, x + 22 + i * 42, y + 9, 10, 7, P.white);
    R(ctx, x + 24 + i * 42, y + 11, 6, 3, i === Math.floor(t / 2) % 4 ? "#3b82f6" : "#cbd5e1");
  }
}

// ── Characters & desks ─────────────────────────────────────────────────────
function drawUnit(
  ctx: Ctx,
  a: OfficeAgent,
  status: AgentStatus,
  selected: boolean,
  t: number,
  index: number
) {
  const { cx, top } = a;
  const isCeo = a.key === "orchestrator";
  const hw = isCeo ? 32 : 24;
  const working = status === "working";
  const bob = working ? 0 : Math.round(Math.sin(t * 1.6 + index) * 0.6);

  // soft floor shadow
  R(ctx, cx - hw, top + 54, hw * 2, 3, "rgba(0,0,0,0.07)");

  // chair
  box(ctx, cx - 9, top + 32, 18, 15, P.chair, "#4b5563");

  // monitor(s)
  const monitors = isCeo ? [cx - 22, cx + 2] : [cx - 12];
  monitors.forEach((mx, mi) => {
    box(ctx, mx, top + 6, 24, 17, P.monitor, "#14161d");
    const sx = mx + 2, sy = top + 8, sw = 20, sh = 13;
    let bg = "#a9bdd3";
    if (working) bg = a.color;
    if (status === "complete") bg = "#22c55e";
    if (status === "error") bg = "#ef4444";
    R(ctx, sx, sy, sw, sh, bg);
    if (working) {
      for (let i = 0; i < 4; i++) {
        const len = 5 + ((Math.sin(t * 3 + i * 1.9 + mi) + 1) / 2) * 11;
        R(ctx, sx + 2, sy + 2 + i * 3, len, 1, "rgba(255,255,255,0.9)");
      }
      R(ctx, sx, sy + (Math.floor(t * 10) % sh), sw, 1, "rgba(255,255,255,0.25)");
    } else if (status === "complete") {
      [[7, 7], [8, 8], [9, 9], [10, 8], [11, 7], [12, 6], [13, 5]].forEach(([dx, dy]) =>
        R(ctx, sx + dx - 1, sy + dy - 1, 2, 2, P.white)
      );
    } else if (status === "error") {
      R(ctx, sx + 9, sy + 2, 2, 6, P.white);
      R(ctx, sx + 9, sy + 10, 2, 2, P.white);
    } else {
      for (let i = 0; i < 3; i++) R(ctx, sx + 2, sy + 3 + i * 3, 6 + ((i * 5) % 7), 1, "rgba(255,255,255,0.55)");
    }
    R(ctx, mx + 10, top + 23, 4, 3, P.monitor);
  });

  // character (body → head → hair → face)
  const by = top + 34 + bob;
  R(ctx, cx - 8, by, 16, 10, a.color);
  R(ctx, cx - 8, by, 16, 2, "rgba(255,255,255,0.25)");
  R(ctx, cx - 5, by - 9, 10, 10, a.skin);
  R(ctx, cx - 6, by - 11, 12, 5, a.hair);
  R(ctx, cx - 6, by - 8, 2, 4, a.hair);
  R(ctx, cx + 4, by - 8, 2, 4, a.hair);
  const blink = Math.floor(t * 1.2 + index * 3) % 7 === 0;
  R(ctx, cx - 3, by - 5, 2, blink ? 1 : 2, P.outline);
  R(ctx, cx + 1, by - 5, 2, blink ? 1 : 2, P.outline);
  R(ctx, cx - 1, by - 1, 3, 1, status === "error" ? "#b91c1c" : "#b9704f");
  if (isCeo) R(ctx, cx - 1, by + 1, 2, 7, "#ffffff"); // tie / shirt line

  // desk
  box(ctx, cx - hw, top + 40, hw * 2, 15, P.desk, P.outline);
  R(ctx, cx - hw + 1, top + 41, hw * 2 - 2, 3, P.deskTop);
  R(ctx, cx - 8, top + 44, 16, 4, "#dfe2ea"); // keyboard
  R(ctx, cx - 7, top + 45, 14, 1, "#b8bdc9");

  // hands
  const hy = working ? (Math.sin(t * 14) > 0 ? 0 : 1) : 0;
  R(ctx, cx - 7, top + 42 + hy, 3, 3, a.skin);
  R(ctx, cx + 4, top + 42 + (working ? 1 - hy : 0), 3, 3, a.skin);

  // desk accessories
  R(ctx, cx + hw - 11, top + 42, 5, 5, P.white); // mug
  R(ctx, cx + hw - 10, top + 43, 3, 2, "#8b5a2b");
  R(ctx, cx - hw + 4, top + 42, 7, 5, "#fffbe6"); // notes
  R(ctx, cx - hw + 5, top + 44, 5, 1, "#d1b24a");

  // selection cursor (corner brackets)
  if (selected) {
    const pad = 3 + Math.round(Math.sin(t * 6));
    const x0 = cx - hw - pad, x1 = cx + hw + pad, y0 = top - 2 - pad, y1 = top + 57 + pad;
    const L = 7, k = "#111827";
    R(ctx, x0, y0, L, 2, k); R(ctx, x0, y0, 2, L, k);
    R(ctx, x1 - L, y0, L, 2, k); R(ctx, x1 - 2, y0, 2, L, k);
    R(ctx, x0, y1 - 2, L, 2, k); R(ctx, x0, y1 - L, 2, L, k);
    R(ctx, x1 - L, y1 - 2, L, 2, k); R(ctx, x1 - 2, y1 - L, 2, L, k);
  }
}

// ── Scene ──────────────────────────────────────────────────────────────────
function drawScene(
  ctx: Ctx,
  states: Record<AgentKey, AgentState>,
  selected: AgentKey | null,
  t: number
) {
  // floor checkers
  for (let ty = 40; ty < OFFICE_H; ty += 16)
    for (let tx = 0; tx < OFFICE_W; tx += 16)
      R(ctx, tx, ty, 16, 16, ((tx + ty) / 16) % 2 === 0 ? P.floorA : P.floorB);

  // CEO carpet
  for (let ty = 40; ty < 116; ty += 8)
    for (let tx = 0; tx < 140; tx += 8)
      R(ctx, tx, ty, 8, 8, ((tx + ty) / 8) % 2 === 0 ? P.carpetA : P.carpetB);

  // back wall
  R(ctx, 0, 0, OFFICE_W, 40, P.wall);
  R(ctx, 0, 36, OFFICE_W, 4, P.wallTrim);
  R(ctx, 0, 40, OFFICE_W, 2, "rgba(0,0,0,0.07)");
  windowPane(ctx, 8, 6, 34, 26);
  poster(ctx, 54, 8, "#ffb454");
  poster(ctx, 76, 8, "#8ccbf7");
  fileCabinet(ctx, 104, 10);
  windowPane(ctx, 150, 6, 34, 26);
  counter(ctx, 196, 20, 36);
  windowPane(ctx, 242, 6, 34, 26);
  counter(ctx, 286, 20, 40);
  plant(ctx, 128, 14);
  plant(ctx, 236, 12);
  snackMachine(ctx, 334, 8);
  cooler(ctx, 366, 14);
  R(ctx, 200, 14, 8, 6, P.white); // coffee machine top
  R(ctx, 202, 10, 4, 4, P.metalDark);

  // orange partitions
  orangeV(ctx, 138, 42, 74);
  orangeH(ctx, 0, 112, 104);
  orangeH(ctx, 152, 118, 218);

  // CEO office decor
  bookshelf(ctx, 6, 46);
  plant(ctx, 120, 48);
  sofa(ctx, 8, 84, 30, 16);

  // lounge
  pingPong(ctx, 12, 140, t);
  bookshelf(ctx, 104, 138);
  plant(ctx, 120, 178);
  sofa(ctx, 8, 212, 52, 22);
  box(ctx, 72, 220, 14, 14, "#ffffff", P.metalDark);
  R(ctx, 75, 223, 8, 8, "#f08a24");

  // meeting room
  meetingRoom(ctx, t);
  plant(ctx, 366, 218);

  // desks + people
  AGENTS.forEach((a, i) => drawUnit(ctx, a, states[a.key]?.status ?? "idle", selected === a.key, t, i));
}

// ── Component ──────────────────────────────────────────────────────────────
interface Props {
  agentStates: Record<AgentKey, AgentState>;
  selected: AgentKey | null;
  onSelect: (key: AgentKey) => void;
}

const BUBBLE: Record<AgentStatus, { text: string; bg: string; fg: string }> = {
  working:  { text: "...", bg: "#ffffff", fg: "#111827" },
  complete: { text: "OK",  bg: "#4ade80", fg: "#052e16" },
  error:    { text: "!",   bg: "#f87171", fg: "#450a0a" },
  idle:     { text: "zz",  bg: "#e5e7eb", fg: "#6b7280" },
};

const STATUS_ES: Record<AgentStatus, string> = {
  working: "trabajando",
  complete: "listo",
  error: "con error",
  idle: "libre",
};

export default function PixelOffice({ agentStates, selected, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statesRef = useRef(agentStates);
  const selectedRef = useRef(selected);
  // Keep the animation loop's refs in sync (refs must not be written during render)
  useEffect(() => {
    statesRef.current = agentStates;
    selectedRef.current = selected;
  }, [agentStates, selected]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as Ctx;
    let raf = 0;
    let last = 0;
    const loop = (ms: number) => {
      raf = requestAnimationFrame(loop);
      if (ms - last < 33) return;
      last = ms;
      drawScene(ctx, statesRef.current, selectedRef.current, ms / 1000);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="relative w-full select-none"
      style={{ aspectRatio: `${OFFICE_W} / ${OFFICE_H}`, containerType: "inline-size" }}
    >
      <canvas
        ref={canvasRef}
        width={OFFICE_W}
        height={OFFICE_H}
        className="absolute inset-0 h-full w-full"
        style={{ imageRendering: "pixelated" }}
      />
      {AGENTS.map((a) => {
        const st = agentStates[a.key]?.status ?? "idle";
        const b = BUBBLE[st];
        const w = a.key === "orchestrator" ? 72 : 56;
        return (
          <button
            key={a.key}
            type="button"
            aria-label={`${a.label}: ${STATUS_ES[st]}`}
            onClick={() => onSelect(a.key)}
            className="absolute cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-black"
            style={{
              left: `${((a.cx - w / 2) / OFFICE_W) * 100}%`,
              top: `${((a.top - 12) / OFFICE_H) * 100}%`,
              width: `${(w / OFFICE_W) * 100}%`,
              height: `${(72 / OFFICE_H) * 100}%`,
            }}
          >
            <span
              className="pointer-events-none absolute left-1/2 top-0 flex -translate-x-1/2 items-center gap-[0.4cqw] whitespace-nowrap border-2 border-[#3a2f2a] px-[1cqw] py-[0.35cqw] font-pixel text-white"
              style={{ background: a.color, fontSize: "clamp(6px, 1.7cqw, 12px)" }}
            >
              {st === "working" && <span className="inline-block animate-spin">⚙</span>}
              {a.label}
            </span>
            <span
              className="pointer-events-none absolute -top-[2.2cqw] left-[calc(50%+4cqw)] flex items-center justify-center border-2 border-[#3a2f2a] font-pixel"
              style={{
                background: b.bg,
                color: b.fg,
                minWidth: "3.4cqw",
                height: "3.4cqw",
                padding: "0 0.6cqw",
                fontSize: "clamp(5px, 1.3cqw, 9px)",
              }}
            >
              {b.text}
            </span>
          </button>
        );
      })}
    </div>
  );
}
