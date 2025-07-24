"use client";

import type React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSSE } from "../../../features/sse/hooks/useSSE";
import type { SSEEvent } from "../../../features/sse/types";
import {
  Activity,
  Send,
  Trash2,
  Wifi,
  WifiOff,
  Users,
  MessageSquare,
  Zap,
} from "lucide-react";

interface EventLog {
  id: string;
  time: string;
  event: string;
  data: unknown;
}

export default function SSEDemoFullPage() {
  const [message, setMessage] = useState("");
  const [events, setEvents] = useState<EventLog[]>([]);
  const [isPageVisible, setIsPageVisible] = useState(true);

  // Use refs to prevent stale closures in event handlers
  const eventsRef = useRef<EventLog[]>([]);
  const handlersRegisteredRef = useRef(false);

  // Update refs when state changes
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const { connected, clientId, addEventListener, removeEventListener } = useSSE(
    {
      url: "/api/sse",
      reconnect: true,
      reconnectDelay: 2000,
      maxReconnectAttempts: 5,
      onOpen: () => {
        console.log("SSE connection established");
      },
      onError: (error) => {
        console.error("SSE connection error:", error);
      },
      onClose: () => {
        console.log("SSE connection closed");
      },
    },
  );

  const addEvent = useCallback((event: string, data: unknown) => {
    const newEvent: EventLog = {
      id: crypto.randomUUID(),
      time: new Date().toLocaleTimeString(),
      event,
      data,
    };

    setEvents((prev) => {
      const updated = [newEvent, ...prev.slice(0, 19)];
      return updated;
    });
  }, []);

  // Register event handlers only once
  useEffect(() => {
    if (handlersRegisteredRef.current) {
      return;
    }

    console.log("[Demo] Registering SSE event handlers");

    const handleConnected = (event: SSEEvent) => {
      console.log("[Demo] Connected event received:", event.data);
      addEvent("connected", event.data);
    };

    const handleMessage = (event: SSEEvent) => {
      console.log("[Demo] Message event received:", event.data);
      addEvent("message", event.data);
    };

    const handlePing = (event: SSEEvent) => {
      console.log("[Demo] Ping event received:", event.data);
      addEvent("ping", event.data);
    };

    // Register handlers
    addEventListener("connected", handleConnected);
    addEventListener("message", handleMessage);
    addEventListener("ping", handlePing);

    handlersRegisteredRef.current = true;

    // Cleanup function
    return () => {
      console.log("[Demo] Cleaning up SSE event handlers");
      removeEventListener("connected", handleConnected);
      removeEventListener("message", handleMessage);
      removeEventListener("ping", handlePing);
      handlersRegisteredRef.current = false;
    };
  }, [addEventListener, removeEventListener, addEvent]);

  // Handle page visibility to prevent unnecessary connections
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const sendMessage = useCallback(async () => {
    if (!message.trim() || !connected) {
      console.warn("[Demo] Cannot send message - no message or not connected");
      return;
    }

    try {
      console.log("[Demo] Sending message:", message.trim());

      const response = await fetch("/api/sse-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "message",
          data: {
            message: message.trim(),
            timestamp: new Date().toISOString(),
            from: clientId || "anonymous",
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("[Demo] Message sent successfully:", result);

      setMessage("");
    } catch (error) {
      console.error("[Demo] Failed to send message:", error);
      addEvent("error", {
        message: "Failed to send message",
        error: String(error),
        timestamp: new Date().toISOString(),
      });
    }
  }, [message, connected, clientId, addEvent]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "connected":
        return <Wifi className="h-4 w-4 text-emerald-500" />;
      case "message":
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case "ping":
        return <Activity className="h-4 w-4 text-gray-500" />;
      case "error":
        return <WifiOff className="h-4 w-4 text-red-500" />;
      default:
        return <Zap className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case "connected":
        return "border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/20";
      case "message":
        return "border-l-blue-500 bg-blue-50 dark:bg-blue-950/20";
      case "ping":
        return "border-l-gray-500 bg-gray-50 dark:bg-gray-950/20";
      case "error":
        return "border-l-red-500 bg-red-50 dark:bg-red-950/20";
      default:
        return "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Background Pattern */}
      <div className="bg-grid-slate-100 dark:bg-grid-slate-800 absolute inset-0 bg-[size:20px_20px] opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-transparent to-transparent dark:from-slate-900/80" />

      <div className="relative z-10 container mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <header className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-3 shadow-lg">
              <Activity className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-4xl font-bold text-transparent dark:from-white dark:to-slate-300">
                Server-Sent Events
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                Real-time Communication Demo
              </p>
            </div>
          </div>

          {!isPageVisible && (
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              Page not visible - some features may be limited
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left Column - Connection Status & Controls */}
          <div className="space-y-6 lg:col-span-1">
            {/* Connection Status Card */}
            <div className="rounded-2xl border border-white/20 bg-white/80 p-6 shadow-xl backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/80">
              <div className="mb-6 flex items-center gap-3">
                <div
                  className={`rounded-xl p-2 transition-all duration-300 ${
                    connected
                      ? "bg-emerald-100 shadow-lg shadow-emerald-500/20 dark:bg-emerald-900/30"
                      : "bg-red-100 shadow-lg shadow-red-500/20 dark:bg-red-900/30"
                  }`}
                >
                  {connected ? (
                    <Wifi className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <WifiOff className="h-6 w-6 text-red-600 dark:text-red-400" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    Connection Status
                  </h3>
                  <p
                    className={`text-sm font-medium ${
                      connected
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {connected ? "Connected" : "Disconnected"}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {clientId && (
                  <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-700/50">
                    <div className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      Client ID
                    </div>
                    <div className="font-mono text-xs break-all text-slate-700 dark:text-slate-300">
                      {clientId}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-700/50">
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                      {events.length}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Events
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-700/50">
                    <div className="flex items-center justify-center gap-1">
                      <div
                        className={`h-2 w-2 rounded-full ${connected ? "animate-pulse bg-emerald-500" : "bg-red-500"}`}
                      />
                      <span className="text-2xl font-bold text-slate-900 dark:text-white">
                        {connected ? "ON" : "OFF"}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Status
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Message Input Card */}
            <div className="rounded-2xl border border-white/20 bg-white/80 p-6 shadow-xl backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/80">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-blue-100 p-2 dark:bg-blue-900/30">
                  <Send className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Send Message
                </h3>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder-slate-400 transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700/50 dark:text-white dark:placeholder-slate-500"
                    disabled={!connected}
                  />
                  {!connected && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-100/50 dark:bg-slate-800/50">
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        Connect to send messages
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={sendMessage}
                  disabled={!connected || !message.trim()}
                  className="w-full transform rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-3 font-medium text-white shadow-lg transition-all duration-200 hover:scale-[1.02] hover:from-blue-600 hover:to-indigo-700 hover:shadow-xl disabled:transform-none disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none dark:disabled:from-slate-600 dark:disabled:to-slate-700"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Send className="h-4 w-4" />
                    Send Broadcast
                  </div>
                </button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="rounded-2xl border border-white/20 bg-white/80 p-6 shadow-xl backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/80">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-indigo-100 p-2 dark:bg-indigo-900/30">
                  <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Quick Info
                </h3>
              </div>

              <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  Open multiple tabs to test broadcasting
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  Messages appear in all connected tabs
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-purple-500" />
                  Auto-reconnects if connection is lost
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Events Log */}
          <div className="lg:col-span-2">
            <div className="h-full rounded-2xl border border-white/20 bg-white/80 shadow-xl backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/80">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 p-6 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-slate-100 p-2 dark:bg-slate-700">
                    <Activity className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      Events Log
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Real-time event stream
                    </p>
                  </div>
                </div>

                <button
                  onClick={clearEvents}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-600 transition-all duration-200 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear
                </button>
              </div>

              {/* Events List */}
              <div className="p-6">
                <div className="custom-scrollbar max-h-[600px] space-y-3 overflow-y-auto">
                  {events.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700">
                        <Activity className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                      </div>
                      <h4 className="mb-2 font-medium text-slate-900 dark:text-white">
                        Waiting for events...
                      </h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {connected
                          ? "Connected and ready to receive events"
                          : "Connecting to server..."}
                      </p>
                    </div>
                  ) : (
                    events.map((event, index) => (
                      <div
                        key={event.id}
                        className={`rounded-r-xl border-l-4 p-4 transition-all duration-200 hover:shadow-md ${getEventColor(
                          event.event,
                        )} ${index === 0 ? "ring-2 ring-blue-500/20 dark:ring-blue-400/20" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex-shrink-0">
                            {getEventIcon(event.event)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex items-center gap-2">
                              <span className="font-mono text-sm font-medium text-slate-600 dark:text-slate-400">
                                {event.time}
                              </span>
                              <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium tracking-wide text-slate-700 uppercase dark:bg-slate-700 dark:text-slate-300">
                                {event.event}
                              </span>
                              {index === 0 && (
                                <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                  Latest
                                </span>
                              )}
                            </div>
                            <div className="overflow-x-auto rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                              <pre className="break-words whitespace-pre-wrap">
                                {typeof event.data === "string"
                                  ? event.data
                                  : JSON.stringify(event.data, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .bg-grid-slate-100 {
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='32' height='32' fill='none' stroke='rgb(148 163 184 / 0.05)'%3e%3cpath d='m0 .5h32m-32 32v-32'/%3e%3c/svg%3e");
        }
        .dark .bg-grid-slate-800 {
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='32' height='32' fill='none' stroke='rgb(51 65 85 / 0.1)'%3e%3cpath d='m0 .5h32m-32 32v-32'/%3e%3c/svg%3e");
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgb(241 245 249 / 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgb(148 163 184 / 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgb(100 116 139 / 0.7);
        }
        .dark .custom-scrollbar::-webkit-scrollbar-track {
          background: rgb(30 41 59 / 0.5);
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgb(71 85 105 / 0.5);
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgb(100 116 139 / 0.7);
        }
      `}</style>
    </div>
  );
}
