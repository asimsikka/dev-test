"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { SSEEventHandler, SSEEvent } from "../types";

interface UseSSEOptions {
  url?: string;
  reconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  onOpen?: () => void;
  onError?: (error: Event) => void;
  onClose?: () => void;
}

interface UseSSEReturn {
  connected: boolean;
  clientId: string | null;
  addEventListener: (event: string, handler: SSEEventHandler) => void;
  removeEventListener: (event: string, handler: SSEEventHandler) => void;
  close: () => void;
  reconnect: () => void;
  reconnectAttempts: number;
}

export function useSSE(options: UseSSEOptions = {}): UseSSEReturn {
  const {
    url = "/api/sse",
    reconnect = true,
    reconnectDelay = 2000,
    maxReconnectAttempts = 5,
    onOpen,
    onError,
    onClose,
  } = options;

  const [connected, setConnected] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const handlersRef = useRef<Map<string, Set<SSEEventHandler>>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(false);
  const isConnectingRef = useRef(false);
  const connectionIdRef = useRef(0);

  const cleanup = useCallback(() => {
    console.log("[SSE] Cleanup initiated");

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      const readyState = eventSourceRef.current.readyState;
      console.log(`[SSE] Closing connection (readyState: ${readyState})`);

      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnected(false);
    setClientId(null);
    isConnectingRef.current = false;
  }, []);

  const connect = useCallback(() => {
    if (
      !mountedRef.current ||
      isConnectingRef.current ||
      eventSourceRef.current
    ) {
      console.log(
        "[SSE] Connection attempt blocked - already connecting or connected",
      );
      return;
    }

    const currentConnectionId = ++connectionIdRef.current;
    isConnectingRef.current = true;

    console.log(`[SSE] Initiating connection ${currentConnectionId} to ${url}`);

    try {
      const eventSource = new EventSource(url);

      if (
        currentConnectionId !== connectionIdRef.current ||
        !mountedRef.current
      ) {
        console.log(
          `[SSE] Connection ${currentConnectionId} superseded, closing`,
        );
        eventSource.close();
        isConnectingRef.current = false;
        return;
      }

      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (
          !mountedRef.current ||
          currentConnectionId !== connectionIdRef.current
        ) {
          console.log(
            `[SSE] Connection ${currentConnectionId} opened but no longer valid`,
          );
          eventSource.close();
          return;
        }

        console.log(
          `[SSE] Connection ${currentConnectionId} established successfully`,
        );
        setConnected(true);
        setReconnectAttempts(0);
        isConnectingRef.current = false;
        onOpen?.();
      };

      eventSource.onerror = (error) => {
        console.error(`[SSE] Connection ${currentConnectionId} error:`, error);

        if (
          !mountedRef.current ||
          currentConnectionId !== connectionIdRef.current
        ) {
          return;
        }

        setConnected(false);
        onError?.(error);
        isConnectingRef.current = false;

        if (eventSourceRef.current === eventSource) {
          eventSourceRef.current = null;
        }
        eventSource.close();

        if (
          reconnect &&
          reconnectAttempts < maxReconnectAttempts &&
          mountedRef.current
        ) {
          const nextAttempt = reconnectAttempts + 1;
          setReconnectAttempts(nextAttempt);

          const delay = Math.min(
            reconnectDelay * Math.pow(1.5, nextAttempt - 1),
            30000,
          ); // Cap at 30s
          console.log(
            `[SSE] Scheduling reconnection ${nextAttempt}/${maxReconnectAttempts} in ${delay}ms`,
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            if (
              mountedRef.current &&
              currentConnectionId === connectionIdRef.current
            ) {
              connect();
            }
          }, delay);
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          console.error("[SSE] Max reconnection attempts reached");
        }
      };

      const setupEventListeners = () => {
        if (
          !eventSource ||
          !mountedRef.current ||
          currentConnectionId !== connectionIdRef.current
        ) {
          return;
        }

        const systemEvents = ["connected", "ping", "error", "message"];

        const customEvents = Array.from(handlersRef.current.keys());

        const allEvents = [...new Set([...systemEvents, ...customEvents])];

        allEvents.forEach((eventType) => {
          eventSource.addEventListener(eventType, (event: MessageEvent) => {
            if (
              !mountedRef.current ||
              currentConnectionId !== connectionIdRef.current
            ) {
              return;
            }

            try {
              const data = JSON.parse(event.data);

              if (eventType === "connected" && data?.clientId) {
                setClientId(data.clientId);
                console.log(`[SSE] Client ID received: ${data.clientId}`);
              }

              const handlers = handlersRef.current.get(eventType);
              if (handlers && handlers.size > 0) {
                const sseEvent: SSEEvent = { event: eventType, data };
                handlers.forEach((handler) => {
                  try {
                    handler(sseEvent);
                  } catch (handlerError) {
                    console.error(
                      `[SSE] Handler error for ${eventType}:`,
                      handlerError,
                    );
                  }
                });
              }
            } catch (parseError) {
              console.error(
                `[SSE] Failed to parse event data for ${eventType}:`,
                parseError,
                event.data,
              );
            }
          });
        });
      };

      setTimeout(setupEventListeners, 100);
    } catch (error) {
      console.error(
        `[SSE] Failed to create EventSource for connection ${currentConnectionId}:`,
        error,
      );
      isConnectingRef.current = false;
      onError?.(error as Event);
    }
  }, [
    url,
    reconnect,
    reconnectDelay,
    maxReconnectAttempts,
    reconnectAttempts,
    onOpen,
    onError,
  ]);

  const addEventListener = useCallback(
    (event: string, handler: SSEEventHandler) => {
      if (!handlersRef.current.has(event)) {
        handlersRef.current.set(event, new Set());
      }
      handlersRef.current.get(event)!.add(handler);
      console.log(`[SSE] Event listener added for: ${event}`);
    },
    [],
  );

  const removeEventListener = useCallback(
    (event: string, handler: SSEEventHandler) => {
      const handlers = handlersRef.current.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          handlersRef.current.delete(event);
        }
        console.log(`[SSE] Event listener removed for: ${event}`);
      }
    },
    [],
  );

  const close = useCallback(() => {
    console.log("[SSE] Manual close requested");
    mountedRef.current = false;
    cleanup();
    onClose?.();
  }, [cleanup, onClose]);

  const reconnectManually = useCallback(() => {
    console.log("[SSE] Manual reconnect requested");
    setReconnectAttempts(0);
    cleanup();

    setTimeout(() => {
      if (mountedRef.current) {
        connect();
      }
    }, 100);
  }, [cleanup, connect]);

  useEffect(() => {
    console.log("[SSE] Hook mounting");
    mountedRef.current = true;

    const initTimer = setTimeout(() => {
      if (mountedRef.current) {
        connect();
      }
    }, 100);

    return () => {
      console.log("[SSE] Hook unmounting");
      clearTimeout(initTimer);
      mountedRef.current = false;
      cleanup();
    };
  }, []);
  useEffect(() => {
    const handleBeforeUnload = () => {
      console.log("[SSE] Page unloading, cleaning up");
      cleanup();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        console.log("[SSE] Page hidden, maintaining connection");
      } else if (
        document.visibilityState === "visible" &&
        !connected &&
        mountedRef.current
      ) {
        console.log("[SSE] Page visible, checking connection");
        if (!eventSourceRef.current && !isConnectingRef.current) {
          setTimeout(connect, 500);
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [connected, connect, cleanup]);

  return {
    connected,
    clientId,
    addEventListener,
    removeEventListener,
    close,
    reconnect: reconnectManually,
    reconnectAttempts,
  };
}
