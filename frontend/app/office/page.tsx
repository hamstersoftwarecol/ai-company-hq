"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { sendTask } from "@/lib/api";
import Link from "next/link";

const PixelOffice = dynamic(() => import("@/components/PixelOffice"), { ssr: false });

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws";

const CREW_INFO: Record<string, { label: string; color: string; room: string }> = {
  marketing:  { label: "Marketing",  color: "#ff6b6b", room: "CEO / Marketing" },
  frontend:   { label: "Frontend",   color: "#4ecdc4", room: "Server Room" },
  backend:    { label: "Backend",    color: "#45b7d1", room: "Server Room" },
  mobile:     { label: "Mobile",     color: "#f9ca24", room: "Planning / Mobile" },
  images:     { label: "Creative",   color: "#6c5ce7", room: "Creative Studio" },
  planning:   { label: "Planning",   color: "#00b894", room: "Meeting Room" },
};

function statusColor(s: string) {
  if (s === "working")  return "#00ff88";
  if (s === "complete") return "#4fc3f7";
  if (s === "error")    return "#ff5252";
  return "#445566";
}

export default function OfficePage() {
  const { agentStates, isConnected, events } = useWebSocket(WS_URL);
  const [input, setInput]   = useState("");
  const [sending, setSending] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const active = Object.values(agentStates).filter((s) => s.status === "working").length;

  async function handleSend() {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await sendTask(input.trim());
      setInput("");
    } catch { /* ignore */ }
    finally { setSending(false); }
  }

  const crews = Object.entries(CREW_INFO);

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#0a0a16", fontFamily: "monospace", display: "flex", flexDirection: "column" }}>

      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "8px 16px",
        background: "rgba(10,10,22,0.95)",
        borderBottom: "1px solid rgba(0,245,255,0.15)",
        flexShrink: 0,
      }}>
        <span style={{ color: "#00f5ff", fontSize: 14, fontWeight: "bold", letterSpacing: 3 }}>AI COMPANY HQ</span>
        <span style={{ color: "#334", fontSize: 11 }}>·</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%", display: "inline-block",
            background: isConnected ? "#00ff88" : "#ff5252",
            boxShadow: isConnected ? "0 0 5px #00ff88" : "none",
          }}/>
          <span style={{ color: isConnected ? "#00ff88" : "#ff5252" }}>
            {isConnected ? "CONECTADO" : "DESCONECTADO"}
          </span>
        </span>
        {active > 0 && (
          <span style={{
            color: "#00ff88", fontSize: 10,
            background: "#00ff8818", border: "1px solid #00ff8835",
            padding: "2px 8px", borderRadius: 20,
          }}>
            {active} activo{active > 1 ? "s" : ""}
          </span>
        )}
        <Link href="/" style={{ marginLeft: "auto", color: "#667", fontSize: 11, textDecoration: "none" }}>
          ← Dashboard
        </Link>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Pixel office canvas */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{
            width: "100%", maxWidth: 700,
            aspectRatio: "4/3",
            border: "2px solid rgba(0,245,255,0.2)",
            borderRadius: 4,
            overflow: "hidden",
            boxShadow: "0 0 30px rgba(0,245,255,0.08)",
          }}>
            <PixelOffice
              agentStates={agentStates}
              onRoomClick={(crew) => setSelected(crew === selected ? null : crew)}
            />
          </div>
        </div>

        {/* Right sidebar: crew status */}
        <div style={{
          width: 220, flexShrink: 0,
          display: "flex", flexDirection: "column", gap: 6,
          padding: "12px 10px",
          borderLeft: "1px solid rgba(255,255,255,0.06)",
          overflowY: "auto",
        }}>
          <div style={{ color: "#667", fontSize: 9, letterSpacing: 2, marginBottom: 4 }}>AGENTES</div>
          {crews.map(([key, info]) => {
            const st = agentStates[key as keyof typeof agentStates];
            const sc = statusColor(st?.status ?? "idle");
            const isWorking = st?.status === "working";
            return (
              <div
                key={key}
                onClick={() => setSelected(key === selected ? null : key)}
                style={{
                  background: selected === key ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.025)",
                  border: `1px solid ${selected === key ? info.color + "60" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 6, padding: "8px 10px", cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: info.color, fontSize: 10, fontWeight: "bold" }}>{info.label.toUpperCase()}</span>
                  <span style={{
                    marginLeft: "auto", fontSize: 8, padding: "1px 5px", borderRadius: 10,
                    background: sc + "20", color: sc,
                  }}>
                    {st?.status ?? "idle"}
                  </span>
                </div>
                <div style={{ color: "#667", fontSize: 8, marginTop: 2 }}>{info.room}</div>
                {st?.currentTask && (
                  <div style={{ color: "#aab", fontSize: 8, marginTop: 4, lineHeight: 1.5 }}>
                    {st.currentTask.slice(0, 50)}{st.currentTask.length > 50 ? "…" : ""}
                  </div>
                )}
                {isWorking && (
                  <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
                    {[0,1,2].map(j => (
                      <div key={j} style={{
                        width: 3, height: 3, borderRadius: "50%", background: "#00ff88",
                        animation: `dot-pulse 1s ${j*0.3}s infinite ease-in-out`,
                      }}/>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Last event log */}
          {events.length > 0 && (
            <div style={{ marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8 }}>
              <div style={{ color: "#667", fontSize: 9, letterSpacing: 2, marginBottom: 4 }}>ÚLTIMO EVENTO</div>
              <div style={{ color: "#4ecdc4", fontSize: 8, lineHeight: 1.6 }}>
                [{events[0].timestamp.slice(11,19)}]<br/>
                <span style={{ color: "#aab" }}>{events[0].crew}/{events[0].agent}</span><br/>
                {events[0].status}
                {events[0].output ? `: ${events[0].output.slice(0,60)}…` : ""}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom command bar */}
      <div style={{
        padding: "10px 16px",
        background: "rgba(10,10,22,0.98)",
        borderTop: "1px solid rgba(0,245,255,0.12)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSend(); }}
            placeholder="Escribe una instrucción para tus agentes…"
            style={{
              flex: 1, background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(0,245,255,0.18)", borderRadius: 6,
              padding: "8px 12px", color: "#fff", fontSize: 12, outline: "none", fontFamily: "monospace",
            }}
          />
          <button onClick={handleSend} disabled={sending || !input.trim()} style={{
            background: sending || !input.trim() ? "rgba(0,245,255,0.06)" : "rgba(0,245,255,0.16)",
            border: "1px solid rgba(0,245,255,0.3)", borderRadius: 6,
            color: "#00f5ff", padding: "8px 20px", cursor: "pointer",
            fontSize: 12, fontFamily: "monospace", letterSpacing: 1,
          }}>
            {sending ? "ENVIANDO…" : "ENVIAR"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes dot-pulse {
          0%,100%{opacity:0.3;transform:scale(0.8)}
          50%{opacity:1;transform:scale(1.2)}
        }
      `}</style>
    </div>
  );
}
