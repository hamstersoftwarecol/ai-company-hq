"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { AgentEvent, AgentState, CrewName } from "@/types/agent";

const DEFAULT_STATES: Record<CrewName, AgentState> = {
  marketing: { crew: "marketing", status: "idle", currentTask: "", lastOutput: "", modelUsed: "" },
  frontend:  { crew: "frontend",  status: "idle", currentTask: "", lastOutput: "", modelUsed: "" },
  backend:   { crew: "backend",   status: "idle", currentTask: "", lastOutput: "", modelUsed: "" },
  mobile:    { crew: "mobile",    status: "idle", currentTask: "", lastOutput: "", modelUsed: "" },
  images:    { crew: "images",    status: "idle", currentTask: "", lastOutput: "", modelUsed: "" },
  planning:  { crew: "planning",  status: "idle", currentTask: "", lastOutput: "", modelUsed: "" },
};

export function useWebSocket(url: string) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [agentStates, setAgentStates] = useState<Record<CrewName, AgentState>>(DEFAULT_STATES);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);

    ws.onmessage = (e) => {
      try {
        const event: AgentEvent = JSON.parse(e.data);
        setEvents((prev) => [...prev.slice(-199), event]);
        setAgentStates((prev) => ({
          ...prev,
          [event.crew as CrewName]: {
            crew: event.crew as CrewName,
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

  return { events, agentStates, isConnected };
}
