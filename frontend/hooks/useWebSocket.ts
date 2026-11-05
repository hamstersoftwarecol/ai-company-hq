"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { AgentEvent, AgentKey, AgentState, PendingQuestions } from "@/types/agent";
import { fetchPending } from "@/lib/api";

const KEYS: AgentKey[] = ["orchestrator", "marketing", "frontend", "backend", "mobile", "images", "planning"];

const DEFAULT_STATES = Object.fromEntries(
  KEYS.map((k) => [k, { crew: k, status: "idle", currentTask: "", lastOutput: "", modelUsed: "" }])
) as Record<AgentKey, AgentState>;

/** `extraKeys`: keys of the agents the user created (events of unknown agents are ignored). */
export function useWebSocket(url: string, extraKeys: string[] = []) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [agentStates, setAgentStates] = useState<Record<AgentKey, AgentState>>(DEFAULT_STATES);
  const [isConnected, setIsConnected] = useState(false);
  const [pending, setPending] = useState<PendingQuestions[]>([]);
  const knownRef = useRef<string[]>(KEYS);
  const extraSignature = extraKeys.join(",");

  useEffect(() => {
    knownRef.current = [...KEYS, ...(extraSignature ? extraSignature.split(",") : [])];
  }, [extraSignature]);

  useEffect(() => {
    // Everything lives inside the effect so a stale socket (React strict mode mounts
    // twice in dev) can never touch state after cleanup.
    let closed = false;
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const socket = new WebSocket(url);
      ws = socket;

      socket.onopen = () => {
        if (closed) return;
        setIsConnected(true);
        // Questions asked while this page was closed or reloading
        fetchPending()
          .then((p) => !closed && setPending(p))
          .catch(() => {});
      };

      socket.onmessage = (e) => {
        if (closed) return;
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
          if (!knownRef.current.includes(event.crew)) return;
          setEvents((prev) => [...prev.slice(-199), event]);
          setAgentStates((prev) => ({
            ...prev,
            [event.crew]: {
              crew: event.crew,
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

      socket.onclose = () => {
        if (closed) return;
        setIsConnected(false);
        timer = setTimeout(connect, 2000);
      };

      socket.onerror = () => socket.close();
    };

    connect();

    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      if (ws) {
        const socket = ws;
        socket.onmessage = socket.onclose = socket.onerror = null;
        if (socket.readyState === WebSocket.CONNECTING) {
          // closing a socket that is still connecting logs a browser warning; close once it opens
          socket.onopen = () => socket.close();
        } else {
          socket.onopen = null;
          socket.close();
        }
      }
    };
  }, [url]);

  const dismissPending = useCallback(
    (id: string) => setPending((prev) => prev.filter((p) => p.task_id !== id)),
    []
  );

  return { events, agentStates, isConnected, pending, dismissPending };
}
