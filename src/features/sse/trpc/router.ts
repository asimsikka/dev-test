import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/lib/trpc";
import { SSEService } from "../services/sse-service";

const eventSchema = z.object({
  event: z.string().min(1).max(50),
  data: z.unknown(),
});

const clientIdSchema = z.string().uuid();

export const sseRouter = createTRPCRouter({
  sendToClient: protectedProcedure
    .input(
      z.object({
        clientId: clientIdSchema,
        ...eventSchema.shape,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const sseService = SSEService.getInstance();

      const sent = sseService.sendToClient(input.clientId, {
        event: input.event,
        data: input.data,
        id: crypto.randomUUID(),
      });

      return {
        success: sent,
        message: sent
          ? "Event sent successfully"
          : "Client not found or unreachable",
      };
    }),

  sendToUser: protectedProcedure
    .input(
      z.object({
        userId: z.string().optional(),
        ...eventSchema.shape,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const sseService = SSEService.getInstance();
      const targetUserId = input.userId || ctx.session.user.id;

      const sentCount = sseService.sendToUser(targetUserId, {
        event: input.event,
        data: input.data,
        id: crypto.randomUUID(),
      });

      return {
        success: sentCount > 0,
        sentCount,
        message: `Event sent to ${sentCount} client(s)`,
      };
    }),

  broadcast: protectedProcedure
    .input(
      z.object({
        excludeClientId: clientIdSchema.optional(),
        ...eventSchema.shape,
      }),
    )
    .mutation(async ({ input }) => {
      const sseService = SSEService.getInstance();

      const sentCount = sseService.broadcast(
        {
          event: input.event,
          data: input.data,
          id: crypto.randomUUID(),
        },
        input.excludeClientId,
      );

      return {
        success: sentCount > 0,
        sentCount,
        message: `Event broadcast to ${sentCount} client(s)`,
      };
    }),

  getActiveClients: protectedProcedure.query(async () => {
    const sseService = SSEService.getInstance();
    const clients = sseService.getActiveClients();

    return {
      clients,
      count: clients.length,
    };
  }),

  getClientsByUser: protectedProcedure
    .input(
      z.object({
        userId: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const sseService = SSEService.getInstance();
      const targetUserId = input.userId || ctx.session.user.id;
      const clients = sseService.getClientsByUser(targetUserId);

      return {
        clients,
        count: clients.length,
        userId: targetUserId,
      };
    }),

  getStats: protectedProcedure.query(async () => {
    const sseService = SSEService.getInstance();
    return sseService.getStats();
  }),

  healthCheck: publicProcedure.query(async () => {
    const sseService = SSEService.getInstance();
    const stats = sseService.getStats();

    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      ...stats,
    };
  }),
});
