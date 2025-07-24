import { randomUUID } from "crypto";
import type { SSEClient, SSEEvent, SSEServiceConfig } from "../types";

declare global {
  var sseServiceInstance: SSEService | undefined;
}

export class SSEService {
  private clients = new Map<string, SSEClient>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private config: Required<SSEServiceConfig>;
  private isShuttingDown = false;

  private constructor(config?: SSEServiceConfig) {
    this.config = {
      heartbeatInterval: config?.heartbeatInterval ?? 30000,
      clientTimeout: config?.clientTimeout ?? 90000,
      reconnectDelay: config?.reconnectDelay ?? 2000,
      maxClients: config?.maxClients ?? 1000,
    };

    this.startHeartbeat();
    this.setupGracefulShutdown();
  }

  static getInstance(config?: SSEServiceConfig): SSEService {
    if (!globalThis.sseServiceInstance) {
      globalThis.sseServiceInstance = new SSEService(config);
    }
    return globalThis.sseServiceInstance;
  }

  static resetInstance(): void {
    if (globalThis.sseServiceInstance) {
      globalThis.sseServiceInstance.cleanup();
      globalThis.sseServiceInstance = undefined;
    }
  }

  addClient(
    controller: ReadableStreamDefaultController,
    userId?: string,
  ): string {
    if (this.isShuttingDown) {
      throw new Error("Service is shutting down");
    }

    if (this.clients.size >= this.config.maxClients) {
      console.warn(`[SSE] Client limit reached (${this.config.maxClients})`);
      throw new Error("Maximum client connections reached");
    }

    const clientId = randomUUID();
    const client: SSEClient = {
      id: clientId,
      userId,
      response: controller,
      lastPing: Date.now(),
      connectedAt: new Date(),
    };

    this.clients.set(clientId, client);

    console.log(
      `[SSE] Client connected: ${clientId}${userId ? ` (user: ${userId})` : ""} - Total: ${this.clients.size}`,
    );

    setTimeout(() => {
      this.sendToClient(clientId, {
        event: "connected",
        data: {
          clientId,
          timestamp: Date.now(),
          serverTime: new Date().toISOString(),
        },
      });
    }, 200);

    return clientId;
  }

  removeClient(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    try {
      if (client.response) {
        client.response.close();
      }
    } catch (error) {
      console.log(`[SSE] Error closing client ${clientId}:`, error);
    }

    this.clients.delete(clientId);

    const connectionDuration = Date.now() - client.connectedAt.getTime();
    console.log(
      `[SSE] Client disconnected: ${clientId} (connected for ${Math.round(connectionDuration / 1000)}s) - Total: ${this.clients.size}`,
    );

    return true;
  }

  sendToClient<T = unknown>(clientId: string, event: SSEEvent<T>): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      console.warn(`[SSE] Client not found: ${clientId}`);
      return false;
    }

    try {
      const eventString = this.formatSSEMessage(event);
      const encoder = new TextEncoder();

      if (client.response.desiredSize === null) {
        console.log(`[SSE] Client ${clientId} controller is closed`);
        this.removeClient(clientId);
        return false;
      }

      client.response.enqueue(encoder.encode(eventString));

      client.lastPing = Date.now();

      return true;
    } catch (error) {
      console.error(`[SSE] Error sending to client ${clientId}:`, error);
      this.removeClient(clientId);
      return false;
    }
  }

  sendToUser<T = unknown>(userId: string, event: SSEEvent<T>): number {
    let sentCount = 0;

    for (const [clientId, client] of this.clients.entries()) {
      if (client.userId === userId) {
        if (this.sendToClient(clientId, event)) {
          sentCount++;
        }
      }
    }

    console.log(
      `[SSE] Sent event '${event.event}' to ${sentCount} clients for user: ${userId}`,
    );
    return sentCount;
  }

  broadcast<T = unknown>(event: SSEEvent<T>, excludeClientId?: string): number {
    let sentCount = 0;

    for (const clientId of this.clients.keys()) {
      if (clientId !== excludeClientId) {
        if (this.sendToClient(clientId, event)) {
          sentCount++;
        }
      }
    }

    console.log(
      `[SSE] Broadcast event '${event.event}' to ${sentCount} clients${
        excludeClientId ? ` (excluded: ${excludeClientId})` : ""
      }`,
    );

    return sentCount;
  }

  getActiveClients(): string[] {
    return Array.from(this.clients.keys());
  }

  getClientsByUser(userId: string): string[] {
    const userClients: string[] = [];

    for (const [clientId, client] of this.clients.entries()) {
      if (client.userId === userId) {
        userClients.push(clientId);
      }
    }

    return userClients;
  }

  getStats() {
    const now = Date.now();
    const connections = Array.from(this.clients.values());

    return {
      totalClients: this.clients.size,
      authenticatedClients: connections.filter((c) => c.userId).length,
      anonymousClients: connections.filter((c) => !c.userId).length,
      averageConnectionTime:
        connections.length > 0
          ? Math.round(
              connections.reduce(
                (sum, c) => sum + (now - c.connectedAt.getTime()),
                0,
              ) /
                connections.length /
                1000,
            )
          : 0,
      oldestConnection:
        connections.length > 0
          ? Math.round(
              (now -
                Math.min(...connections.map((c) => c.connectedAt.getTime()))) /
                1000,
            )
          : 0,
    };
  }

  private formatSSEMessage<T>(event: SSEEvent<T>): string {
    const lines: string[] = [];

    if (event.id) {
      lines.push(`id: ${event.id}`);
    }

    lines.push(`event: ${event.event}`);
    lines.push(`data: ${JSON.stringify(event.data)}`);

    if (event.retry) {
      lines.push(`retry: ${event.retry}`);
    }

    return lines.join("\n") + "\n\n";
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.isShuttingDown) return;

      const now = Date.now();
      const timeout = this.config.clientTimeout;
      const staleClients: string[] = [];

      for (const [clientId, client] of this.clients.entries()) {
        const timeSinceLastPing = now - client.lastPing;

        if (timeSinceLastPing > timeout) {
          staleClients.push(clientId);
          continue;
        }

        const sent = this.sendToClient(clientId, {
          event: "ping",
          data: {
            timestamp: now,
            serverTime: new Date().toISOString(),
          },
        });

        if (!sent) {
          staleClients.push(clientId);
        }
      }

      staleClients.forEach((clientId) => {
        console.log(`[SSE] Removing stale client: ${clientId}`);
        this.removeClient(clientId);
      });

      if (this.clients.size > 0) {
        const stats = this.getStats();
        console.log(
          `[SSE] Heartbeat - Active: ${stats.totalClients} (${stats.authenticatedClients} auth, ${stats.anonymousClients} anon)`,
        );
      }
    }, this.config.heartbeatInterval);
  }

  private setupGracefulShutdown(): void {
    const shutdown = () => {
      console.log("[SSE] Graceful shutdown initiated");
      this.isShuttingDown = true;
      this.cleanup();
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  }

  cleanup(): void {
    console.log("[SSE] Cleaning up SSE service");

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    const clientIds = Array.from(this.clients.keys());
    clientIds.forEach((clientId) => {
      try {
        this.sendToClient(clientId, {
          event: "server-shutdown",
          data: { message: "Server is shutting down", timestamp: Date.now() },
        });
      } catch (error) {}

      this.removeClient(clientId);
    });

    console.log("[SSE] Cleanup completed");
  }
}
