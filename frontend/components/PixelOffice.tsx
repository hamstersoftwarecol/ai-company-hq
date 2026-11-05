"use client";

import { useEffect, useRef } from "react";
import type { AgentState } from "@/types/agent";

// ── Palette ─────────────────────────────────────────────────────────────
const C = {
  wall:     "#2d2d3a",
  wallDark: "#1a1a26",
  floor1:   "#b8956a",
  floor2:   "#a07d58",
  floorGray:"#8a8a9e",
  floorGray2:"#7a7a8e",
  carpet1:  "#4a5a8c",
  carpet2:  "#3d4f7a",
  wood1:    "#c4915a",
  wood2:    "#b07d48",
  desk:     "#6b4a2a",
  deskTop:  "#8b6a3a",
  monitor:  "#1a1a2e",
  screen:   "#0d1b2a",
  chair:    "#2d4a6b",
  chairDark:"#1f3550",
  plant:    "#2d6b3a",
  plantDark:"#1f4f28",
  pot:      "#8b5a2a",
  sofa:     "#4a3a6b",
  sofaDark: "#352a50",
  serverRack:"#2a3a4a",
  serverLight:"#00ff88",
  bookshelf:"#5a3a1a",
  window:   "#6ab4d4",
  windowFr: "#4a2a0a",
  meeting:  "#2a4a5a",
  table:    "#3a2a1a",
  neonBlue: "#00f5ff",
  neonPink: "#ff006e",
  neonPurp: "#8338ec",
};

// ── Helpers ──────────────────────────────────────────────────────────────
function px(x: number) { return Math.round(x); }

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, stroke?: string) {
  ctx.fillStyle = fill;
  ctx.fillRect(px(x), px(y), px(w), px(h));
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(px(x) + 0.5, px(y) + 0.5, px(w) - 1, px(h) - 1);
  }
}

function tile(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c1: string, c2: string, size = 8) {
  ctx.fillStyle = c1;
  ctx.fillRect(px(x), px(y), px(w), px(h));
  ctx.fillStyle = c2;
  for (let ty = 0; ty < h; ty += size) {
    for (let tx = (ty / size % 2 === 0) ? 0 : size; tx < w; tx += size * 2) {
      ctx.fillRect(px(x + tx), px(y + ty), px(size), px(size));
    }
  }
}

function monitor(ctx: CanvasRenderingContext2D, x: number, y: number, working: boolean, color: string, t: number) {
  rect(ctx, x, y + 2, 20, 12, C.monitor, "#000");
  // screen glow
  const sc = working ? color : "#0d1a2a";
  ctx.fillStyle = sc;
  ctx.fillRect(px(x + 2), px(y + 3), 16, 8);
  if (working) {
    // scanline animation
    const line = Math.floor(t * 8) % 8;
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(px(x + 2), px(y + 3 + line), 16, 1);
  }
  rect(ctx, x + 8, y + 14, 4, 3, C.desk);
  rect(ctx, x + 5, y + 17, 10, 2, C.desk);
}

function plant(ctx: CanvasRenderingContext2D, x: number, y: number) {
  rect(ctx, x + 2, y + 8, 6, 5, C.pot, "#000");
  ctx.fillStyle = C.plantDark;
  ctx.fillRect(px(x), py(y + 2), 10, 8);
  ctx.fillStyle = C.plant;
  ctx.fillRect(px(x + 1), py(y), 8, 7);
  ctx.fillRect(px(x + 3), py(y - 2), 4, 4);
}

// helper to avoid name collision
function py(y: number) { return Math.round(y); }

function chair(ctx: CanvasRenderingContext2D, x: number, y: number, dir: "up" | "down" | "left" | "right" = "down") {
  rect(ctx, x, y, 10, 10, C.chair, C.chairDark);
  if (dir === "down")  rect(ctx, x, y + 10, 10, 3, C.chairDark);
  if (dir === "up")    rect(ctx, x, y - 3, 10, 3, C.chairDark);
  if (dir === "left")  rect(ctx, x - 3, y, 3, 10, C.chairDark);
  if (dir === "right") rect(ctx, x + 10, y, 3, 10, C.chairDark);
}

function character(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, working: boolean, t: number) {
  // body
  ctx.fillStyle = color;
  ctx.fillRect(px(x + 2), px(y + 4), 8, 8);
  // head
  ctx.fillStyle = "#f4c89a";
  ctx.fillRect(px(x + 3), px(y), 6, 5);
  // hair
  ctx.fillStyle = "#4a3a2a";
  ctx.fillRect(px(x + 3), px(y), 6, 2);
  if (working) {
    // typing animation
    const off = Math.sin(t * 5) > 0 ? 1 : 0;
    ctx.fillStyle = "#fff";
    ctx.fillRect(px(x + 1), px(y + 10 + off), 3, 2);
    ctx.fillRect(px(x + 8), px(y + 10 + off), 3, 2);
  }
}

function statusDot(ctx: CanvasRenderingContext2D, x: number, y: number, status: string, t: number) {
  let color = "#445566";
  if (status === "working") color = "#00ff88";
  else if (status === "complete") color = "#4fc3f7";
  else if (status === "error") color = "#ff5252";

  const pulse = status === "working" ? 0.5 + Math.sin(t * 4) * 0.5 : 1;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(px(x), py(y), 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ── Room drawers ─────────────────────────────────────────────────────────

function drawCEOOffice(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, state: AgentState | undefined, t: number) {
  // Floor - wood
  tile(ctx, x, y, w, h, C.wood1, C.wood2, 10);
  // carpet
  rect(ctx, x + 15, y + 20, w - 30, h - 35, "#2a3a5a");
  rect(ctx, x + 18, y + 23, w - 36, h - 41, "#1e2d4f");
  // desk
  rect(ctx, x + 20, y + 30, 60, 30, C.deskTop, C.desk);
  rect(ctx, x + 22, y + 32, 56, 25, C.desk);
  monitor(ctx, x + 25, y + 25, state?.status === "working", "#6c5ce7", t);
  monitor(ctx, x + 50, y + 22, state?.status === "working", "#a855f7", t);
  // chair behind desk
  chair(ctx, x + 42, y + 55, "up");
  // sofa
  rect(ctx, x + 15, y + 90, 65, 18, C.sofa, C.sofaDark);
  rect(ctx, x + 15, y + 90, 10, 18, C.sofaDark);
  rect(ctx, x + 70, y + 90, 10, 18, C.sofaDark);
  // bookshelf
  rect(ctx, x + 5, y + 20, 12, h - 40, C.bookshelf, "#000");
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = ["#c0392b","#2980b9","#27ae60","#f39c12"][i];
    ctx.fillRect(px(x + 6), py(y + 24 + i * 18), 10, 14);
  }
  // window
  rect(ctx, x + 20, y + 5, 55, 20, C.window, C.windowFr);
  rect(ctx, x + 47, y + 5, 2, 20, C.windowFr);
  // plants
  plant(ctx, x + w - 18, y + 20);
  plant(ctx, x + w - 18, y + h - 25);
  // agent
  if (state) {
    character(ctx, x + 44, y + 42, "#6c5ce7", state.status === "working", t);
    statusDot(ctx, x + w - 10, y + 10, state.status, t);
  }
}

function drawServerRoom(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, states: (AgentState | undefined)[], t: number) {
  // Floor - gray industrial
  tile(ctx, x, y, w, h, C.floorGray, C.floorGray2, 12);
  // Server racks
  for (let i = 0; i < 3; i++) {
    rect(ctx, x + 10 + i * 35, y + 10, 25, h - 25, C.serverRack, "#000");
    for (let j = 0; j < 6; j++) {
      const on = Math.sin(t * 3 + i * 2 + j) > 0;
      ctx.fillStyle = on ? C.serverLight : "#115533";
      ctx.fillRect(px(x + 13 + i * 35), py(y + 15 + j * 12), 6, 3);
      ctx.fillStyle = "#1a3a5a";
      ctx.fillRect(px(x + 22 + i * 35), py(y + 15 + j * 12), 10, 3);
    }
    // cable at bottom
    rect(ctx, x + 10 + i * 35, y + h - 15, 25, 5, "#0a0a1a");
  }
  // desks with monitors
  rect(ctx, x + 5, y + h - 55, w - 10, 20, C.deskTop, C.desk);
  for (let i = 0; i < 2; i++) {
    monitor(ctx, x + 15 + i * 60, y + h - 60, states[i]?.status === "working", ["#45b7d1","#4ecdc4"][i], t);
    if (states[i]) {
      character(ctx, x + 20 + i * 60, y + h - 45, ["#45b7d1","#4ecdc4"][i], states[i]?.status === "working", t);
      statusDot(ctx, x + 15 + i * 55 + 5, y + 10, states[i]?.status ?? "idle", t);
    }
  }
  // cable conduits on ceiling
  for (let i = 0; i < 4; i++) {
    rect(ctx, x, y + 2 + i * 3, w, 2, "#1a2a3a");
  }
}

function drawCreativeStudio(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, states: (AgentState | undefined)[], t: number) {
  // Floor - warm wood
  tile(ctx, x, y, w, h, C.floor1, C.floor2, 12);
  // Large monitor/screen wall
  rect(ctx, x + 10, y + 10, w - 20, 30, C.monitor, "#000");
  const prog = states[0]?.status === "working" ? Math.sin(t * 2) * 0.5 + 0.5 : 0;
  // color gradient on screen
  const grad = ctx.createLinearGradient(x + 12, 0, x + w - 12, 0);
  grad.addColorStop(0, "#ff006e");
  grad.addColorStop(0.5, "#8338ec");
  grad.addColorStop(1, "#3a86ff");
  ctx.fillStyle = states[0]?.status === "working" ? grad : "#0a0a1a";
  ctx.fillRect(px(x + 12), py(y + 12), px(w - 24), 26);
  if (states[0]?.status === "working") {
    // waveform
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let xi = 0; xi < w - 24; xi += 2) {
      const wave = Math.sin(xi * 0.1 + t * 4) * 6 + 25;
      if (xi === 0) ctx.moveTo(px(x + 12 + xi), py(y + 12 + wave));
      else ctx.lineTo(px(x + 12 + xi), py(y + 12 + wave));
    }
    ctx.stroke();
  }
  // desks
  rect(ctx, x + 10, y + 55, w - 20, 18, C.deskTop, C.desk);
  for (let i = 0; i < 2; i++) {
    monitor(ctx, x + 15 + i * 55, y + 48, states[i]?.status === "working", ["#ff6b6b","#f9ca24"][i], t);
    if (states[i]) {
      character(ctx, x + 20 + i * 55, y + 60, ["#ff6b6b","#f9ca24"][i], states[i]?.status === "working", t);
      statusDot(ctx, x + 10 + i * 55, y + h - 10, states[i]?.status ?? "idle", t);
    }
  }
  // plants
  plant(ctx, x + 5, y + h - 25);
  plant(ctx, x + w - 18, y + h - 25);
  // color swatches on wall
  const swatches = ["#ff006e","#f9ca24","#45b7d1","#00b894","#6c5ce7"];
  swatches.forEach((c, i) => {
    rect(ctx, x + 10 + i * 20, y + h - 18, 16, 10, c, "#000");
  });
}

function drawMeetingRoom(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, states: (AgentState | undefined)[], t: number) {
  // Floor - wood
  tile(ctx, x, y, w, h, C.wood1, C.wood2, 10);
  // Round table
  const cx2 = x + w / 2, cy2 = y + h / 2 - 5;
  ctx.fillStyle = C.table;
  ctx.beginPath();
  ctx.arc(px(cx2), py(cy2), 35, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2a1a0a";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = C.deskTop;
  ctx.beginPath();
  ctx.arc(px(cx2), py(cy2), 32, 0, Math.PI * 2);
  ctx.fill();
  // chairs around table
  const angles = [0, 60, 120, 180, 240, 300];
  angles.forEach((a) => {
    const rad = (a * Math.PI) / 180;
    const cx3 = cx2 + Math.cos(rad) * 44;
    const cy3 = cy2 + Math.sin(rad) * 44;
    rect(ctx, px(cx3 - 7), py(cy3 - 7), 14, 14, C.chair, C.chairDark);
  });
  // whiteboard
  rect(ctx, x + 10, y + 8, w - 20, 22, "#e8e8f0", "#aaa");
  rect(ctx, x + 12, y + 10, w - 24, 18, "#f0f0ff");
  if (states[0]?.status === "working") {
    ctx.strokeStyle = "#2244cc";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px(x + 20), py(y + 15));
    for (let i = 0; i < 50; i += 5) {
      ctx.lineTo(px(x + 20 + i), py(y + 15 + Math.sin(i * 0.5 + t * 2) * 5));
    }
    ctx.stroke();
  }
  // agents
  if (states[0]) {
    character(ctx, px(cx2 - 25), py(cy2 - 40), "#00b894", states[0].status === "working", t);
    statusDot(ctx, x + w - 10, y + 10, states[0].status, t);
  }
  if (states[1]) {
    character(ctx, px(cx2 + 10), py(cy2 - 40), "#45b7d1", states[1].status === "working", t);
    statusDot(ctx, x + w - 25, y + 10, states[1].status, t);
  }
  // plants
  plant(ctx, x + w - 15, y + h - 25);
}

function drawLounge(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, state: AgentState | undefined, t: number) {
  // Floor - warm
  tile(ctx, x, y, w, h, C.floor1, C.floor2, 10);
  // rug
  rect(ctx, x + 10, y + 30, w - 20, h - 50, "#5a2a6a");
  rect(ctx, x + 14, y + 34, w - 28, h - 58, "#4a1a5a");
  // sofa
  rect(ctx, x + 10, y + 55, 50, 22, C.sofa, C.sofaDark);
  rect(ctx, x + 10, y + 55, 8, 22, C.sofaDark);
  rect(ctx, x + 52, y + 55, 8, 22, C.sofaDark);
  // coffee table
  rect(ctx, x + 20, y + 80, 30, 15, C.deskTop, C.desk);
  // coffee machine
  rect(ctx, x + w - 30, y + 15, 20, 30, "#2a2a3a", "#000");
  rect(ctx, x + w - 26, y + 18, 12, 10, "#1a1a2a");
  ctx.fillStyle = state?.status === "working" ? "#ff4400" : "#441100";
  ctx.fillRect(px(x + w - 24), py(y + 20), 8, 6);
  // small monitor
  monitor(ctx, x + 15, y + 20, false, "#a855f7", t);
  // plants
  plant(ctx, x + 5, y + 20);
  plant(ctx, x + 5, y + h - 25);
  plant(ctx, x + w - 18, y + h - 25);
  // agent relaxing
  if (state) {
    character(ctx, x + 28, y + 50, "#a855f7", state.status === "working", t);
    statusDot(ctx, x + w - 10, y + 10, state.status, t);
  }
}

function drawMobileHub(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, state: AgentState | undefined, t: number) {
  // Floor
  tile(ctx, x, y, w, h, C.floorGray, C.floorGray2, 10);
  // desk row
  rect(ctx, x + 5, y + 30, w - 10, 20, C.deskTop, C.desk);
  // phones/tablets mockup
  for (let i = 0; i < 3; i++) {
    rect(ctx, x + 10 + i * 30, y + 20, 18, 30, C.monitor, "#000");
    ctx.fillStyle = state?.status === "working" ? ["#f9ca24","#ff6b6b","#4ecdc4"][i] : "#0a0a1a";
    ctx.fillRect(px(x + 12 + i * 30), py(y + 22), 14, 24);
    if (state?.status === "working") {
      const scanY = Math.floor(t * 6 + i * 3) % 24;
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(px(x + 12 + i * 30), py(y + 22 + scanY), 14, 1);
    }
  }
  // main monitor
  monitor(ctx, x + w / 2 - 10, y + h - 50, state?.status === "working", "#f9ca24", t);
  if (state) {
    character(ctx, x + w / 2 - 5, y + h - 38, "#f9ca24", state.status === "working", t);
    statusDot(ctx, x + w - 10, y + 10, state.status, t);
  }
  plant(ctx, x + 5, y + h - 25);
}

// ── Main component ────────────────────────────────────────────────────────
export default function PixelOffice({ agentStates, onRoomClick }: {
  agentStates: Record<string, AgentState>;
  onRoomClick?: (crew: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef  = useRef(agentStates);
  useEffect(() => { stateRef.current = agentStates; }, [agentStates]);

  // Click detection
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onRoomClick) return;
    const onClick = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / r.width;
      const scaleY = canvas.height / r.height;
      const mx = (e.clientX - r.left) * scaleX;
      const my = (e.clientY - r.top)  * scaleY;
      const W = canvas.width, H = canvas.height;
      const hW = W / 2 - 15, hH = H / 2 - 15;
      // map click to rooms
      if (mx < hW && my < hH)             onRoomClick("marketing");
      else if (mx > hW + 30 && my < hH)   onRoomClick("backend");
      else if (mx < hW && my > hH + 30)   onRoomClick("planning");
      else if (mx > hW + 30 && my > hH + 30) onRoomClick("mobile");
    };
    canvas.addEventListener("click", onClick);
    return () => canvas.removeEventListener("click", onClick);
  }, [onRoomClick]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    let raf = 0;
    const start = Date.now();

    function draw() {
      raf = requestAnimationFrame(draw);
      const t = (Date.now() - start) / 1000;
      const st = stateRef.current;
      const W = canvas!.width, H = canvas!.height;

      // ── Background ─────────────────────────────────────────────────
      ctx.fillStyle = C.wallDark;
      ctx.fillRect(0, 0, W, H);

      // Room sizes
      const pad  = 8;
      const hall = 30;
      const rW   = (W - 2 * pad - hall) / 2;
      const rH   = (H - 2 * pad - hall) / 2;
      const hX   = pad + rW;
      const hY   = pad + rH;

      // ── Hallway / lobby ─────────────────────────────────────────
      tile(ctx, hX, pad, hall, H - 2 * pad, C.floorGray, C.floorGray2, 8);
      tile(ctx, pad, hY, W - 2 * pad, hall, C.floorGray, C.floorGray2, 8);
      // Lobby center
      rect(ctx, hX, hY, hall, hall, "#6a6a7e");
      // bulletin board in lobby
      rect(ctx, hX + 5, hY + 5, hall - 10, hall - 10, "#c8a86a", "#8a7040");
      ctx.fillStyle = "#fff";
      ctx.font = "5px monospace";
      ctx.fillText("HQ", hX + 11, hY + 17);

      // ── Walls between rooms ──────────────────────────────────────
      ctx.fillStyle = C.wall;
      ctx.fillRect(0, 0, W, pad);
      ctx.fillRect(0, H - pad, W, pad);
      ctx.fillRect(0, 0, pad, H);
      ctx.fillRect(W - pad, 0, pad, H);

      // Room labels (door frames)
      ctx.fillStyle = C.wall;
      ctx.fillRect(pad + rW - 2, pad, 2, rH);       // top-left border right
      ctx.fillRect(hX + hall, pad, 2, rH);           // top-right border left
      ctx.fillRect(pad + rW - 2, hY + hall, 2, rH);  // bot-left border right
      ctx.fillRect(hX + hall, hY + hall, 2, rH);     // bot-right border left
      ctx.fillRect(pad, pad + rH - 2, hX - pad, 2);  // left rooms divider bottom
      ctx.fillRect(hX + hall, pad + rH - 2, W - hX - hall - pad, 2);

      // ── Rooms ───────────────────────────────────────────────────
      // Top-left: CEO (orchestrator + marketing)
      drawCEOOffice(ctx, pad, pad, rW - 2, rH - 2, st["marketing"], t);

      // Top-right: Server room (backend + frontend)
      drawServerRoom(ctx, hX + hall + 2, pad, rW - 2, rH - 2,
        [st["backend"], st["frontend"]], t);

      // Bottom-left: Creative studio (images)
      drawCreativeStudio(ctx, pad, hY + hall + 2, rW - 2, rH - 2,
        [st["images"], st["marketing"]], t);

      // Bottom-right: Meeting room (planning + mobile)
      drawMeetingRoom(ctx, hX + hall + 2, hY + hall + 2, rW - 2, rH - 2,
        [st["planning"], st["mobile"]], t);

      // ── Room signs ───────────────────────────────────────────────
      ctx.font      = "bold 7px monospace";
      ctx.textAlign = "left";
      const signs: [number, number, string, string][] = [
        [pad + 3,          pad + rH - 8, "CEO / MARKETING", st["marketing"]?.status ?? "idle"],
        [hX + hall + 3,    pad + rH - 8, "SERVER ROOM",    "idle"],
        [pad + 3,          H - pad - 8,  "CREATIVE STUDIO","idle"],
        [hX + hall + 3,    H - pad - 8,  "PLANNING / MOBILE","idle"],
      ];
      signs.forEach(([sx, sy, label, status]) => {
        const sc = status === "working" ? C.serverLight : "#aab";
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(px(sx - 2), py(sy - 7), label.length * 4.5 + 4, 10);
        ctx.fillStyle = sc;
        ctx.fillText(label, px(sx), py(sy));
      });

      // ── Neon border ──────────────────────────────────────────────
      const alpha = 0.6 + Math.sin(t * 1.5) * 0.2;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = C.neonBlue;
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, W - 2, H - 2);
      ctx.strokeStyle = C.neonPurp;
      ctx.lineWidth = 1;
      ctx.strokeRect(3, 3, W - 6, H - 6);
      ctx.globalAlpha = 1;
    }

    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={560}
      height={420}
      style={{
        width: "100%",
        height: "100%",
        imageRendering: "pixelated",
        cursor: "pointer",
      }}
    />
  );
}
