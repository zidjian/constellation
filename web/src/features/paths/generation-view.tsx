"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Constellation } from "@/features/constellation/constellation";
import { starStates } from "@/features/constellation/star-state";
import { ApiError, apiUrl } from "@/lib/api";
import { readSse } from "@/lib/sse";
import { type Course, type GenerationEvent, LEVEL_LABEL } from "./types";

type Step = { position: number; course: Course; prerequisites: string[]; rationale?: string };
type Status = { kind: "streaming" } | { kind: "done"; pathId: string; truncated: boolean } | { kind: "error"; code: string; message: string };

const ERROR_ACTION: Record<string, { label: string; href: string }> = {
  PATH_LIMIT_REACHED: { label: "Ir a mis rutas", href: "/paths" },
  PATH_NOTHING_TO_LEARN: { label: "Hacer otra entrevista", href: "/assessment" },
  RATE_LIMITED: { label: "Ver mis rutas", href: "/paths" },
};

export function GenerationView({ assessmentId, name }: { assessmentId: string; name: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [steps, setSteps] = useState<Step[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "streaming" });
  useEffect(() => {
    // Al desmontar (o en el doble montaje de StrictMode en dev) se aborta: la API no guarda una
    // generación cortada, así que solo persiste la que llega a `done`.
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(apiUrl("/paths/generate"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assessmentId, name }),
          signal: ac.signal,
        });
        await readSse(
          res,
          (raw) => {
            const e = raw as GenerationEvent;
            if (e.event === "step") setSteps((s) => [...s, { ...e.data }]);
            if (e.event === "rationale")
              setSteps((s) => s.map((st) => (st.position === e.data.position ? { ...st, rationale: e.data.text } : st)));
            if (e.event === "done") {
              setStatus({ kind: "done", pathId: e.data.pathId, truncated: e.data.truncated });
              router.prefetch(`/paths/${e.data.pathId}`);
            }
            if (e.event === "error") setStatus({ kind: "error", ...e.data });
          },
          ac.signal,
        );
      } catch (err) {
        if (ac.signal.aborted) return;
        setStatus(
          err instanceof ApiError
            ? { kind: "error", code: err.code, message: err.message }
            : { kind: "error", code: "NETWORK", message: "Se cortó la conexión mientras trazábamos tu ruta." },
        );
      }
    })();
    return () => ac.abort();
  }, [assessmentId, name, router]);

  const edges = useMemo(
    () => steps.flatMap((s) => s.prerequisites.map((from) => ({ from, to: s.course.slug }))),
    [steps],
  );
  const states = useMemo(() => starStates(steps.map((s) => ({ slug: s.course.slug, completed: false })), edges), [steps, edges]);
  const stars = steps.map((s) => ({
    slug: s.course.slug,
    title: s.course.title,
    position: s.position,
    state: states.get(s.course.slug) ?? ("locked" as const),
  }));

  return (
    <section aria-labelledby="gen-title" className="flex flex-col gap-6">
      <div aria-live="polite" className="flex flex-col gap-1">
        <h1 id="gen-title" className="text-2xl font-semibold sm:text-3xl">
          {status.kind === "done" ? "Tu constelación está lista" : status.kind === "error" ? "No pudimos trazar tu ruta" : "Trazando tu constelación…"}
        </h1>
        <p className="text-ink-muted">
          {status.kind === "done"
            ? `${steps.length} cursos en el orden que tiene sentido para ti.${status.truncated ? " La recortamos a los primeros 15 para que sea abarcable." : ""}`
            : status.kind === "error"
              ? status.message
              : `${steps.length} ${steps.length === 1 ? "estrella" : "estrellas"} por ahora`}
        </p>
      </div>

      {status.kind === "error" && (
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={ERROR_ACTION[status.code]?.href ?? "/paths"}>
            {ERROR_ACTION[status.code]?.label ?? "Volver a mis rutas"}
          </ButtonLink>
        </div>
      )}

      {steps.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
          <Constellation
            stars={stars}
            edges={edges}
            label={`Constelación de ${steps.length} cursos en construcción`}
            className="h-72 rounded-lg border border-line bg-surface/60 sm:h-[26rem] lg:sticky lg:top-20"
          />
          <ol className="flex flex-col gap-3" aria-label="Pasos de la ruta">
            <AnimatePresence initial={false}>
              {steps.map((s) => (
                <motion.li
                  key={s.course.slug}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="rounded-md border border-line px-4 py-3"
                >
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">
                      <span className="text-ink-muted">{s.position + 1}. </span>
                      {s.course.title}
                    </span>
                    <span className="shrink-0 text-xs text-ink-muted">
                      {LEVEL_LABEL[s.course.level]} · {s.course.durationHours} h
                    </span>
                  </p>
                  {s.rationale ? (
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{s.rationale}</p>
                  ) : (
                    <span aria-hidden className="mt-2 block h-3.5 w-3/4 animate-pulse rounded bg-surface-2" />
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        </div>
      )}

      {status.kind === "done" && (
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink href={`/paths/${status.pathId}`} size="lg" autoFocus>
            Ver mi constelación
          </ButtonLink>
          <span className="text-sm text-ink-muted">Ya está guardada en tus rutas.</span>
        </div>
      )}
    </section>
  );
}
