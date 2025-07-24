import type { NextRequest } from "next/server";
import { getSession } from "@/features/auth";
import { SSEService } from "@/features/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const sseService = SSEService.getInstance();

    // Create readable stream for SSE
    const stream = new ReadableStream({
      start(controller) {
        // Add client to SSE service
        const clientId = sseService.addClient(controller, session?.user?.id);

        // Set up keep-alive mechanism
        const keepAlive = setInterval(() => {
          try {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(": keep-alive\n\n"));
          } catch (error) {
            console.error("[SSE] Keep-alive error:", error);
            clearInterval(keepAlive);
          }
        }, 15000);

        // Handle client disconnect
        const cleanup = () => {
          clearInterval(keepAlive);
          sseService.removeClient(clientId);
        };

        // Listen for connection abort
        request.signal.addEventListener("abort", cleanup);

        // Store cleanup function for potential manual cleanup
        (controller as any)._cleanup = cleanup;
      },

      cancel() {
        // Additional cleanup if stream is cancelled
        if ((this as any)._cleanup) {
          (this as any)._cleanup();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Cache-Control",
      },
    });
  } catch (error) {
    console.error("[SSE] Connection setup error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
