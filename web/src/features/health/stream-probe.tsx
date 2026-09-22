"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/api";
import { readSse, type SseEvent } from "@/lib/sse";

// Temporal (F0): comprueba que el SSE llega evento a evento a través de Nginx.
export function StreamProbe() {
  const [events, setEvents] = useState<(SseEvent & { receivedAt: string })[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setEvents([]);
    setError(null);
    setRunning(true);
    try {
      const res = await fetch(apiUrl("/health/stream"), { credentials: "include" });
      await readSse(res, (e) =>
        setEvents((prev) => [...prev, { ...e, receivedAt: new Date().toLocaleTimeString() }]),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <button
        type="button"
        onClick={run}
        disabled={running}
        className="self-start rounded-md border border-current px-3 py-1.5 text-sm disabled:opacity-50"
      >
        {running ? "Recibiendo…" : "Probar stream SSE"}
      </button>
      {error && <p className="text-sm text-red-500">Error: {error}</p>}
      <ol className="font-mono text-sm">
        {events.map((e, i) => (
          <li key={i}>
            {e.receivedAt} · {e.event} · {JSON.stringify(e.data)}
          </li>
        ))}
      </ol>
    </section>
  );
}
