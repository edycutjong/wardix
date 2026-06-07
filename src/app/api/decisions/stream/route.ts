import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  let lastCount = 0;
  const encoder = new TextEncoder();

  const customStream = new ReadableStream({
    start(controller) {
      const sendUpdate = () => {
        try {
          const db = getDb();
          const currentCount = db.decisions.length;
          if (currentCount > lastCount) {
            const newDecisions = db.decisions.slice(lastCount);
            for (const dec of newDecisions) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(dec)}\n\n`));
            }
            lastCount = currentCount;
          }
        } catch {
          // Stream might have closed
        }
      };

      // Send initial history
      sendUpdate();

      // Poll for updates
      const interval = setInterval(sendUpdate, 500);

      (controller as any)._interval = interval;
    },
    cancel() {
      // Handle client disconnect by clearing interval if possible
    }
  });

  return new Response(customStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    }
  });
}
export async function POST() {
  return new Response('Method Not Allowed', { status: 405 });
}
export async function PUT() {
  return new Response('Method Not Allowed', { status: 405 });
}
export async function DELETE() {
  return new Response('Method Not Allowed', { status: 405 });
}
