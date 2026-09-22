import { describe, expect, it } from "vitest";
import { readSse, type SseEvent } from "./sse";

const stream = (chunks: string[]) =>
  new Response(
    new ReadableStream({
      start(c) {
        const enc = new TextEncoder();
        chunks.forEach((chunk) => c.enqueue(enc.encode(chunk)));
        c.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );

const collect = async (res: Response, signal?: AbortSignal) => {
  const events: SseEvent[] = [];
  await readSse(res, (e) => events.push(e), signal);
  return events;
};

describe("readSse", () => {
  it("reconstruye eventos partidos entre chunks", async () => {
    const events = await collect(stream(['event: step\nda', 'ta: {"n":1}\n', "\nevent: done\ndata: {}\n\n"]));
    expect(events).toEqual([
      { event: "step", data: { n: 1 } },
      { event: "done", data: {} },
    ]);
  });

  it("lanza ApiError si la respuesta es un error de la API, no un stream", async () => {
    const res = new Response(JSON.stringify({ error: { code: "RATE_LIMITED", message: "Espera" } }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
    await expect(collect(res)).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
  });

  it("aborta con AbortError y deja de emitir", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(collect(stream(["event: step\ndata: {}\n\n"]), ac.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});
