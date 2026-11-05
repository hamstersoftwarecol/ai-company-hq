"use client";

import dynamic from "next/dynamic";
import { useState, useRef, useEffect, useCallback } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { sendTask } from "@/lib/api";
import Link from "next/link";
import * as THREE from "three";
import type { OfficeHandle } from "@/components/OfficeScene";

const OfficeScene = dynamic(() => import("@/components/OfficeScene"), { ssr: false });

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws";

const CREW_NAMES  = ["marketing","frontend","backend","mobile","images","planning"];
const CREW_LABELS = ["Marketing","Frontend","Backend","Mobile","Images","Planning"];
const CREW_COLORS = ["#ff6b6b","#4ecdc4","#45b7d1","#f9ca24","#6c5ce7","#00b894"];
const DESK_WORLD: [number, number, number][] = [
  [-5, 2.2, -4],[0, 2.2, -4],[5, 2.2, -4],
  [-5, 2.2,  2],[0, 2.2,  2],[5, 2.2,  2],
];

function statusColor(s: string) {
  if (s === "working") return "#00ff88";
  if (s === "complete") return "#4fc3f7";
  if (s === "error") return "#ff5252";
  return "#445566";
}

interface LabelPos { x: number; y: number; visible: boolean }

export default function OfficePage() {
  const { agentStates, isConnected, events } = useWebSocket(WS_URL);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [locked, setLocked] = useState(false);
  const [labelPositions, setLabelPositions] = useState<LabelPos[]>(
    CREW_NAMES.map(() => ({ x: 0, y: 0, visible: false }))
  );

  const handleRef = useRef<OfficeHandle>({ camera: null, renderer: null });
  const rafRef = useRef<number>(0);

  const active = Object.values(agentStates).filter((s) => s.status === "working").length;

  // Track pointer lock
  useEffect(() => {
    const onChange = () => setLocked(document.pointerLockElement !== null);
    document.addEventListener("pointerlockchange", onChange);
    return () => document.removeEventListener("pointerlockchange", onChange);
  }, []);

  // Project 3D → 2D labels every frame
  const startProjection = useCallback(() => {
    const v = new THREE.Vector3();
    function loop() {
      rafRef.current = requestAnimationFrame(loop);
      const { camera, renderer } = handleRef.current;
      if (!camera || !renderer) return;
      const w = renderer.domElement.clientWidth;
      const h = renderer.domElement.clientHeight;
      const positions = DESK_WORLD.map(([wx, wy, wz]) => {
        v.set(wx, wy, wz);
        v.project(camera);
        const x = (v.x * 0.5 + 0.5) * w;
        const y = (-v.y * 0.5 + 0.5) * h;
        return { x, y, visible: v.z < 1 && x > 0 && x < w && y > 0 && y < h };
      });
      setLabelPositions(positions);
    }
    loop();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handleReady = useCallback((h: OfficeHandle) => {
    handleRef.current = h;
    startProjection();
  }, [startProjection]);

  async function handleSend() {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await sendTask(input.trim());
      setLog((p) => [`${new Date().toLocaleTimeString()} — ${input.trim()}`, ...p.slice(0, 9)]);
      setInput("");
    } catch { /* ignore */ }
    finally { setSending(false); }
  }

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#020210", fontFamily: "monospace" }}>
      {/* 3D canvas */}
      <div style={{ position: "absolute", inset: 0 }}>
        <OfficeScene agentStates={agentStates} onReady={handleReady} />
      </div>

      {/* Floating agent labels projected from 3D */}
      {CREW_NAMES.map((crew, i) => {
        const lp = labelPositions[i];
        if (!lp.visible) return null;
        const st = agentStates[crew];
        const sc = statusColor(st?.status ?? "idle");
        const isWorking = st?.status === "working";
        return (
          <div
            key={crew}
            style={{
              position: "absolute",
              left: lp.x,
              top: lp.y,
              transform: "translate(-50%, -100%)",
              zIndex: 15,
              pointerEvents: "none",
              minWidth: 140,
            }}
          >
            <div style={{
              background: "rgba(5,5,20,0.88)",
              border: `1px solid ${CREW_COLORS[i]}44`,
              borderRadius: 6,
              padding: "5px 10px",
              backdropFilter: "blur(4px)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: CREW_COLORS[i], fontWeight: "bold", fontSize: 11, letterSpacing: 1 }}>
                  {CREW_LABELS[i].toUpperCase()}
                </span>
                <span style={{
                  marginLeft: "auto", fontSize: 9, padding: "1px 6px", borderRadius: 10,
                  background: sc + "22", color: sc,
                }}>
                  {st?.status ?? "idle"}
                </span>
              </div>
              {st?.currentTask ? (
                <div style={{ color: "#aab", fontSize: 9, marginTop: 3, lineHeight: 1.4, maxWidth: 160 }}>
                  {st.currentTask.slice(0, 60)}{st.currentTask.length > 60 ? "…" : ""}
                </div>
              ) : (
                <div style={{ color: "#334", fontSize: 9, marginTop: 2 }}>Esperando…</div>
              )}
              {isWorking && (
                <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
                  {[0,1,2].map(j => (
                    <div key={j} style={{
                      width: 4, height: 4, borderRadius: "50%", background: "#00ff88",
                      animation: `dot-pulse 1s ${j*0.3}s infinite ease-in-out`,
                    }}/>
                  ))}
                </div>
              )}
            </div>
            {/* Arrow pointing down to desk */}
            <div style={{
              width: 0, height: 0, margin: "0 auto",
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: `6px solid ${CREW_COLORS[i]}44`,
            }}/>
          </div>
        );
      })}

      {/* Click to lock overlay */}
      {!locked && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 25,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,10,0.6)", backdropFilter: "blur(3px)",
          cursor: "pointer",
        }}
          onClick={() => document.querySelector("canvas")?.requestPointerLock()}
        >
          <div style={{ color: "#00f5ff", fontSize: 24, fontWeight: "bold", letterSpacing: 4, marginBottom: 12 }}>
            AI COMPANY HQ
          </div>
          <div style={{ color: "#aab", fontSize: 13, marginBottom: 24 }}>Haz clic para entrar a la oficina</div>
          <div style={{ color: "#445", fontSize: 11, lineHeight: 2, textAlign: "center" }}>
            WASD / ↑←↓→ — Moverse · Mouse — Mirar · ESC — Salir
          </div>
        </div>
      )}

      {/* Top HUD */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
        display: "flex", alignItems: "center", gap: 16,
        padding: "10px 20px",
        background: "linear-gradient(to bottom, rgba(2,2,16,0.9), transparent)",
        pointerEvents: "none",
      }}>
        <span style={{ color: "#00f5ff", fontSize: 15, fontWeight: "bold", letterSpacing: 3 }}>AI COMPANY HQ</span>
        <span style={{ color: "#334", fontSize: 11 }}>|</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", display: "inline-block",
            background: isConnected ? "#00ff88" : "#ff5252",
            boxShadow: isConnected ? "0 0 6px #00ff88" : "none",
          }}/>
          <span style={{ color: isConnected ? "#00ff88" : "#ff5252" }}>
            {isConnected ? "CONECTADO" : "DESCONECTADO"}
          </span>
        </span>
        {active > 0 && (
          <span style={{
            color: "#00ff88", fontSize: 11,
            background: "#00ff8820", border: "1px solid #00ff8840",
            padding: "2px 10px", borderRadius: 20,
          }}>
            {active} agente{active > 1 ? "s" : ""} activo{active > 1 ? "s" : ""}
          </span>
        )}
        <Link href="/" style={{ marginLeft: "auto", color: "#334", fontSize: 11, textDecoration: "none", pointerEvents: "all" }}>
          ← Dashboard
        </Link>
      </div>

      {/* Bottom command bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20,
        padding: "14px 20px",
        background: "linear-gradient(to top, rgba(2,2,16,0.95), transparent)",
      }}>
        {events.length > 0 && (
          <div style={{ marginBottom: 6, color: "#4ecdc4", fontSize: 10 }}>
            [{events[0].timestamp.slice(11,19)}] {events[0].crew}/{events[0].agent} — {events[0].status}
            {events[0].output ? ` · ${events[0].output.slice(0,70)}…` : ""}
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSend(); }}
            placeholder="Escribe una instrucción para tus agentes…"
            style={{
              flex: 1, background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(0,245,255,0.2)", borderRadius: 8,
              padding: "10px 14px", color: "#fff", fontSize: 13, outline: "none", fontFamily: "monospace",
            }}
          />
          <button onClick={handleSend} disabled={sending || !input.trim()} style={{
            background: sending || !input.trim() ? "rgba(0,245,255,0.08)" : "rgba(0,245,255,0.18)",
            border: "1px solid rgba(0,245,255,0.35)", borderRadius: 8,
            color: "#00f5ff", padding: "10px 24px", cursor: "pointer",
            fontSize: 13, fontFamily: "monospace", letterSpacing: 1,
          }}>
            {sending ? "ENVIANDO…" : "ENVIAR"}
          </button>
        </div>
      </div>

      {/* Crosshair */}
      {locked && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%,-50%)", zIndex: 15,
          pointerEvents: "none", color: "rgba(255,255,255,0.5)", fontSize: 18,
        }}>+</div>
      )}

      <style>{`
        @keyframes dot-pulse {
          0%,100%{opacity:0.3;transform:scale(0.8)}
          50%{opacity:1;transform:scale(1.2)}
        }
      `}</style>
    </div>
  );
}
