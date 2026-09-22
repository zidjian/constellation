// Lector de Server-Sent Events sobre fetch + ReadableStream.
// EventSource no sirve: solo hace GET y no manda body (la generación de rutas es POST).
export type SseEvent = { event: string; data: unknown };

export async function readSse(
  res: Response,
  onEvent: (e: SseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!res.body) throw new Error("La respuesta no tiene cuerpo");
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  signal?.addEventListener("abort", () => void reader.cancel(), { once: true });

  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    // Un evento termina en línea en blanco; los chunks pueden partir un evento a la mitad.
    let boundary: number;
    while ((boundary = buffer.search(/\r?\n\r?\n/)) >= 0) {
      const raw = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary).replace(/^\r?\n\r?\n/, "");
      const parsed = parseEvent(raw);
      if (parsed) onEvent(parsed);
    }
  }
}

function parseEvent(raw: string): SseEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (!data.length) return null;
  const text = data.join("\n");
  try {
    return { event, data: JSON.parse(text) };
  } catch {
    return { event, data: text };
  }
}
