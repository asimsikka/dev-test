export interface SSEClient {
  id: string;
  userId?: string;
  response: ReadableStreamDefaultController;
  lastPing: number;
  connectedAt: Date;
}

export interface SSEEvent<T = unknown> {
  id?: string;
  event: string;
  data: T;
  retry?: number;
}

export interface SSEMessage {
  type: "ping" | "message" | "error" | "notification";
  timestamp: number;
  data?: unknown;
}

export type SSEEventHandler<T = unknown> = (event: SSEEvent<T>) => void;

export interface SSEServiceConfig {
  heartbeatInterval?: number;
  clientTimeout?: number;
  reconnectDelay?: number;
  maxClients?: number;
}

export interface SSEEventPayload {
  event: string;
  data: unknown;
}

export interface TypedSSEMessage<T = unknown> {
  event: string;
  data: T;
}

export interface SSEConnectionStatus {
  connected: boolean;
  clientId: string | null;
  reconnectAttempts: number;
  lastError?: string;
}

export interface SSEServiceStats {
  totalClients: number;
  authenticatedClients: number;
  anonymousClients: number;
  averageConnectionTime: number;
  oldestConnection: number;
}

export namespace SSEEventData {
  export interface Connected {
    clientId: string;
    timestamp: number;
    serverTime: string;
  }

  export interface Ping {
    timestamp: number;
    serverTime: string;
  }

  export interface Message {
    message: string;
    from?: string;
    timestamp: string;
  }

  export interface Error {
    message: string;
    code?: string;
    timestamp: number;
  }

  export interface Notification {
    title: string;
    body: string;
    type: "info" | "success" | "warning" | "error";
    timestamp: number;
  }
}
