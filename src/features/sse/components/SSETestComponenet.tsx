"use client";

import type React from "react";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSSE } from "../hooks/useSSE";
import type { SSEEvent } from "../types";
import { api } from "@/trpc/react";

interface Message {
  id: string;
  type: "sent" | "received" | "connected" | "error" | "system";
  content: string;
  timestamp: Date;
  from?: string;
}

export function SSETestComponenet() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [customMessage, setCustomMessage] = useState("");

  const broadcastMutation = api.sse.broadcast.useMutation();
  const getActiveClientsQuery = api.sse.getActiveClients.useQuery(undefined, {
    refetchInterval: 5000,
    staleTime: 4000,
  });

  const { connected, addEventListener, removeEventListener } = useSSE({
    onOpen: () => console.log("SSE connection opened"),
    onError: (error) => console.error("SSE connection error:", error),
    onClose: () => console.log("SSE connection closed"),
  });

  const addMessage = useCallback(
    (type: Message["type"], content: string, from?: string) => {
      const message: Message = {
        id: crypto.randomUUID(),
        type,
        content: from ? `[${from}]: ${content}` : content,
        timestamp: new Date(),
        from,
      };

      setMessages((prev) => [...prev, message].slice(-20));
    },
    [],
  );

  useEffect(() => {
    const eventHandlers = {
      connected: (event: SSEEvent) => {
        const data = event.data as { clientId: string; timestamp: number };
        setClientId(data.clientId);
        addMessage("connected", `Connected with client ID: ${data.clientId}`);
      },

      ping: (event: SSEEvent) => {
        const data = event.data as { timestamp: number };
        console.log("Received ping:", new Date(data.timestamp).toISOString());
      },

      "custom-event": (event: SSEEvent) => {
        const data = event.data as { message: string; from?: string };
        addMessage("received", data.message, data.from);
      },
    };

    Object.entries(eventHandlers).forEach(([eventType, handler]) => {
      addEventListener(eventType, handler);
    });

    // Cleanup
    return () => {
      Object.entries(eventHandlers).forEach(([eventType, handler]) => {
        removeEventListener(eventType, handler);
      });
    };
  }, [addEventListener, removeEventListener, addMessage]);

  const handleBroadcast = useCallback(async () => {
    if (!customMessage.trim() || !connected) return;

    try {
      await broadcastMutation.mutateAsync({
        event: "custom-event",
        data: {
          message: customMessage.trim(),
          from: clientId ?? "unknown",
          timestamp: new Date().toISOString(),
        },
        excludeClientId: clientId ?? undefined,
      });

      addMessage("sent", customMessage.trim(), "You");
      setCustomMessage("");
    } catch (error) {
      console.error("Failed to broadcast message:", error);
      addMessage("error", "Failed to send message");
    }
  }, [customMessage, connected, clientId, broadcastMutation, addMessage]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleBroadcast();
      }
    },
    [handleBroadcast],
  );

  const messageTypeStyles = useMemo(
    () => ({
      sent: "bg-blue-100 text-blue-700 border-l-4 border-blue-400",
      received: "bg-green-100 text-green-700 border-l-4 border-green-400",
      connected:
        "bg-emerald-100 text-emerald-700 border-l-4 border-emerald-400",
      error: "bg-red-100 text-red-700 border-l-4 border-red-400",
      system: "bg-gray-100 text-gray-700 border-l-4 border-gray-400",
    }),
    [],
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h2 className="mb-2 text-3xl font-bold">SSE Demo</h2>
        <p className="text-gray-600">
          Real-time messaging with Server-Sent Events
        </p>
      </header>

      <div className="rounded-lg border bg-gradient-to-r from-gray-50 to-gray-100 p-6">
        <div className="mb-3 flex items-center gap-3">
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

        <div className="grid grid-cols-1 gap-4 text-sm text-gray-600 md:grid-cols-2">
          {clientId && (
            <div className="rounded bg-white p-2 font-mono">
              <span className="font-semibold">Client ID:</span> {clientId}
            </div>
          )}
          <div className="rounded bg-white p-2">
            <span className="font-semibold">Active Clients:</span>{" "}
            {getActiveClientsQuery.data?.clients.length ?? 0}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold">Send Broadcast Message</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 rounded-lg border px-4 py-3 transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            disabled={!connected}
          />
          <button
            onClick={handleBroadcast}
            disabled={
              !connected || !customMessage.trim() || broadcastMutation.isPending
            }
            className="rounded-lg bg-blue-500 px-6 py-3 font-semibold text-white transition-all hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {broadcastMutation.isPending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b p-6">
          <h3 className="text-lg font-semibold">Messages</h3>
        </div>
        <div className="max-h-96 overflow-y-auto p-6">
          {messages.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <div className="mb-2 text-4xl">💬</div>
              <p>No messages yet...</p>
              <p className="mt-1 text-sm">Send a message to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg p-4 transition-all hover:shadow-md ${messageTypeStyles[msg.type]}`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      {msg.timestamp.toLocaleTimeString()}
                    </span>
                    <span className="text-xs font-medium tracking-wide uppercase">
                      {msg.type}
                    </span>
                  </div>
                  <div className="break-words">{msg.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
