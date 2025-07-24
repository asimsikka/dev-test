"use client";

import { useState, useEffect, useCallback } from "react";
import { useSSE } from "../hooks/useSSE";
import type { SSEEvent } from "../types";

interface Message {
  id: string;
  type: "connected" | "ping" | "system";
  content: string;
  timestamp: Date;
}

export function SSEPublic() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [connectionTime, setConnectionTime] = useState<Date | null>(null);

  const { connected, addEventListener, removeEventListener } = useSSE({
    onOpen: () => {
      console.log("SSE connection opened");
      setConnectionTime(new Date());
    },
    onError: (error) => console.error("SSE connection error:", error),
    onClose: () => {
      console.log("SSE connection closed");
      setConnectionTime(null);
    },
  });

  const addMessage = useCallback((type: Message["type"], content: string) => {
    const message: Message = {
      id: crypto.randomUUID(),
      type,
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, message].slice(-15));
  }, []);

  useEffect(() => {
    const eventHandlers = {
      connected: (event: SSEEvent) => {
        const data = event.data as { clientId: string; timestamp: number };
        setClientId(data.clientId);
        addMessage("connected", `Connected with client ID: ${data.clientId}`);
      },

      ping: (event: SSEEvent) => {
        const data = event.data as { timestamp: number };
        addMessage(
          "ping",
          `Heartbeat received at ${new Date(data.timestamp).toLocaleTimeString()}`,
        );
      },
    };

    Object.entries(eventHandlers).forEach(([eventType, handler]) => {
      addEventListener(eventType, handler);
    });

    return () => {
      Object.entries(eventHandlers).forEach(([eventType, handler]) => {
        removeEventListener(eventType, handler);
      });
    };
  }, [addEventListener, removeEventListener, addMessage]);

  const getConnectionDuration = useCallback(() => {
    if (!connectionTime) return "Not connected";

    const now = new Date();
    const diff = now.getTime() - connectionTime.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }, [connectionTime]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h2 className="mb-2 text-3xl font-bold">SSE Demo (Public)</h2>
        <p className="text-gray-600">
          Public demonstration of Server-Sent Events
        </p>
      </header>

      <div className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
        <div className="mb-4 flex items-center gap-3">
          <div
            className={`h-4 w-4 rounded-full transition-all ${
              connected
                ? "animate-pulse bg-green-500 shadow-lg shadow-green-500/50"
                : "bg-red-500"
            }`}
          />
          <span className="text-lg font-semibold">
            Status: {connected ? "Connected" : "Disconnected"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          {clientId && (
            <div className="rounded-lg border bg-white p-3">
              <div className="mb-1 font-semibold text-gray-700">Client ID</div>
              <div className="font-mono text-xs break-all text-gray-600">
                {clientId}
              </div>
            </div>
          )}
          <div className="rounded-lg border bg-white p-3">
            <div className="mb-1 font-semibold text-gray-700">
              Connection Duration
            </div>
            <div className="text-gray-600">{getConnectionDuration()}</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-amber-800">
          <span>🚀</span>
          How to Test This Demo
        </h3>
        <ol className="list-inside list-decimal space-y-2 text-sm text-amber-700">
          <li>Open this page in multiple browser tabs or windows</li>
          <li>Each tab will receive a unique client ID upon connection</li>
          <li>
            Watch for automatic heartbeat (ping) messages every 30 seconds
          </li>
          <li>
            The connection status indicator shows real-time connection state
          </li>
          <li>Connection automatically reconnects if lost</li>
          <li>For full messaging functionality, authentication is required</li>
        </ol>
      </div>

      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b bg-gray-50 p-6">
          <h3 className="text-lg font-semibold">Events Log</h3>
          <p className="mt-1 text-sm text-gray-600">
            Real-time events from the server
          </p>
        </div>
        <div className="max-h-80 overflow-y-auto p-6">
          {messages.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <div className="mb-2 text-4xl">⏳</div>
              <p>Waiting for events...</p>
              <p className="mt-1 text-sm">Connection events will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg border-l-4 p-4 transition-all hover:shadow-sm ${
                    msg.type === "connected"
                      ? "border-green-400 bg-green-50 text-green-700"
                      : msg.type === "ping"
                        ? "border-blue-400 bg-blue-50 text-blue-700"
                        : "border-gray-400 bg-gray-50 text-gray-700"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      {msg.timestamp.toLocaleTimeString()}
                    </span>
                    <span className="text-xs font-medium tracking-wide uppercase opacity-75">
                      {msg.type}
                    </span>
                  </div>
                  <div className="text-sm">{msg.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">
        <p className="mb-1">
          <strong>Note:</strong> This demonstrates SSE connection and heartbeat
          functionality.
        </p>
        <p>Open developer tools to see detailed connection logs.</p>
      </div>
    </div>
  );
}
