"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { AgentEvent, AgentKey, AgentState, PendingQuestions } from "@/types/agent";
import { fetchPending } from "@/lib/api";

const KEYS: AgentKey[] = ["orchestrator", "marketing", "frontend", "backend", "mobile", "images", "planning"];

const DEFAULT_STATES = Object.fromEntries(
  KEYS.map((k) => [k, { crew: k, status: "idle", currentTask: "", lastOutput: "", modelUsed: "" }])
) as Record<AgentKey, AgentState>;

export function useWebSocket(url: string) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [agentStates, setAgentStates] = useState<Record<AgentKey, AgentState>>(DEFAULT_STATES);
  const [isConnected, setIsConnected] = useState(false);
  const [pending, setPending] = useState<PendingQuestions[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      // Questions asked while this page was closed or reloading
      fetchPending().then(setPending).catch(() => {});
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "questions") {
          setPending((prev) => [...prev.filter((p) => p.task_id !== data.task_id), data as PendingQuestions]);
          return;
        }
        if (data.type === "questions_resolved") {
          setPending((prev) => prev.filter((p) => p.task_id !== data.task_id));
          return;
        }
        const event: AgentEvent = data;
        if (!KEYS.includes(event.crew as AgentKey)) return;
        setEvents((prev) => [...prev.slice(-199), event]);
        setAgentStates((prev) => ({
          ...prev,
          [event.crew]: {
            crew: event.crew as AgentKey,
            status: event.status,
            currentTask: event.task,
            lastOutput: event.output,
            modelUsed: event.model_used,
          },
        }));
      } catch {
        // ignore malformed events
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => ws.close();
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { events, agentStates, isConnected, pending, dismissPending: (id: string) => setPending((prev) => prev.filter((p) => p.task_id !== id)) };
}
