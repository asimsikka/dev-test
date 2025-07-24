# SSE Service - Backend Integration Guide

## Quick Integration for Backend Modules

### 1. Send notification to a specific user

\`\`\`typescript
import { SSEService } from '@/features/sse';

// In your webhook handler, job processor, etc.
export async function notifyUser(userId: string, message: string) {
const sseService = SSEService.getInstance();

sseService.sendToUser(userId, {
event: 'notification',
data: {
message,
timestamp: new Date().toISOString()
}
});
}
\`\`\`

### 2. Broadcast to all connected clients

\`\`\`typescript
export async function broadcastSystemMessage(message: string) {
const sseService = SSEService.getInstance();

sseService.broadcast({
event: 'system-announcement',
data: { message, type: 'info' }
});
}
\`\`\`

### 3. Integration Examples

#### Webhook Handler

\`\`\`typescript
// app/api/webhooks/payment/route.ts
import { SSEService } from '@/features/sse';

export async function POST(request: Request) {
const payload = await request.json();

if (payload.event === 'payment.completed') {
const sseService = SSEService.getInstance();

    // Notify the specific user
    sseService.sendToUser(payload.userId, {
      event: 'payment-completed',
      data: {
        amount: payload.amount,
        status: 'completed'
      }
    });

}

return Response.json({ received: true });
}
\`\`\`

#### Background Job

\`\`\`typescript
// lib/jobs/process-order.ts
import { SSEService } from '@/features/sse';

export async function processOrder(orderId: string, userId: string) {
const sseService = SSEService.getInstance();

// Notify start
sseService.sendToUser(userId, {
event: 'order-processing',
data: { orderId, status: 'started' }
});

try {
// Process order...
await processOrderLogic(orderId);

    // Notify completion
    sseService.sendToUser(userId, {
      event: 'order-completed',
      data: { orderId, status: 'completed' }
    });

} catch (error) {
// Notify error
sseService.sendToUser(userId, {
event: 'order-error',
data: { orderId, error: error.message }
});
}
}
\`\`\`

## Available Methods

- `sendToClient(clientId, event)` - Send to specific client connection
- `sendToUser(userId, event)` - Send to all connections for a user
- `broadcast(event, excludeClientId?)` - Send to all connected clients
- `getActiveClients()` - Get list of active client IDs
- `getClientsByUser(userId)` - Get client IDs for specific user

## Event Format

\`\`\`typescript
{
event: string, // Event name (e.g., 'notification', 'update')
data: any, // Your payload data
id?: string, // Optional event ID
retry?: number // Optional retry interval
}
