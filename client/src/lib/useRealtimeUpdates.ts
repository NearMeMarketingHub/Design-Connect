import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface RealtimeEvent {
  type: "messages" | "project" | "changeorder" | "estimate" | "invoice" | "chatmessage";
  projectId?: string;
  chatId?: string;
  companyId?: string | null;
  clientUserId?: string | null;
  allowedUserIds?: string[];
}

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;

function getWsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

export function useRealtimeUpdates(enabled: boolean = true): void {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return;

    function connect() {
      if (!mountedRef.current) return;

      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        backoffRef.current = INITIAL_BACKOFF_MS;
      };

      ws.onmessage = (event) => {
        try {
          const data: RealtimeEvent = JSON.parse(event.data);
          handleEvent(data);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        schedule();
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    function schedule() {
      if (!mountedRef.current) return;
      const delay = backoffRef.current;
      backoffRef.current = Math.min(delay * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
      reconnectTimerRef.current = setTimeout(connect, delay);
    }

    function handleEvent(event: RealtimeEvent) {
      const { type, projectId, chatId } = event;

      switch (type) {
        case "messages":
          if (projectId) {
            queryClient.invalidateQueries({
              queryKey: ["/api/projects", projectId, "messages"],
            });
          }
          break;
        case "chatmessage":
          if (chatId) {
            queryClient.invalidateQueries({
              queryKey: ["/api/chats", chatId, "messages"],
            });
          }
          if (projectId) {
            queryClient.invalidateQueries({
              queryKey: ["/api/projects", projectId, "chats"],
            });
          }
          break;
        case "project":
          queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
          if (projectId) {
            queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
          }
          break;
        case "changeorder":
          if (projectId) {
            queryClient.invalidateQueries({
              queryKey: ["/api/projects", projectId, "change-orders"],
            });
          }
          break;
        case "estimate":
          queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
          if (projectId) {
            queryClient.invalidateQueries({
              queryKey: ["/api/projects", projectId, "estimates"],
            });
          }
          break;
        case "invoice":
          queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
          if (projectId) {
            queryClient.invalidateQueries({
              queryKey: ["/api/projects", projectId, "invoices"],
            });
          }
          break;
      }
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, queryClient]);
}
