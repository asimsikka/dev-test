import { type NextRequest, NextResponse } from "next/server";
import { SSEService } from "@/features/sse";
import { z } from "zod";

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;

const broadcastSchema = z.object({
  event: z.string().min(1).max(50),
  data: z.unknown(),
  targetClientId: z.string().uuid().optional(),
  excludeClientId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const clientIP =
      request.ip || request.headers.get("x-forwarded-for") || "unknown";

    const now = Date.now();
    const clientLimit = rateLimitMap.get(clientIP);

    if (clientLimit) {
      if (now < clientLimit.resetTime) {
        if (clientLimit.count >= RATE_LIMIT) {
          return NextResponse.json(
            { error: "Rate limit exceeded" },
            { status: 429 },
          );
        }
        clientLimit.count++;
      } else {
        rateLimitMap.set(clientIP, { count: 1, resetTime: now + RATE_WINDOW });
      }
    } else {
      rateLimitMap.set(clientIP, { count: 1, resetTime: now + RATE_WINDOW });
    }

    const body = await request.json();
    const validatedData = broadcastSchema.parse(body);

    const sseService = SSEService.getInstance();
    let sentCount = 0;

    if (validatedData.targetClientId) {
      const sent = sseService.sendToClient(validatedData.targetClientId, {
        event: validatedData.event,
        data: validatedData.data,
      });
      sentCount = sent ? 1 : 0;
    } else {
      sentCount = sseService.broadcast(
        {
          event: validatedData.event,
          data: validatedData.data,
        },
        validatedData.excludeClientId,
      );
    }

    return NextResponse.json({
      success: true,
      message: `Event broadcast to ${sentCount} client(s)`,
      sentCount,
    });
  } catch (error) {
    console.error("[SSE] Broadcast error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Failed to broadcast event" },
      { status: 500 },
    );
  }
}

setInterval(
  () => {
    const now = Date.now();
    for (const [ip, limit] of rateLimitMap.entries()) {
      if (now > limit.resetTime) {
        rateLimitMap.delete(ip);
      }
    }
  },
  5 * 60 * 1000,
);
