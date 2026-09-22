"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Star, STAR_LABEL, type StarState } from "@/components/ui/star";
import { Constellation } from "@/features/constellation/constellation";
import { nextStar, starStates } from "@/features/constellation/star-state";
import { ApiError } from "@/lib/api";
import { setStepCompletion } from "./api";
import { progressLabel, StarRow } from "./star-row";
import { LEVEL_LABEL, type PathDetail, type PathStep } from "./types";

export function PathView({ initial }: { initial: PathDetail }) {
  const reduce = useReducedMotion();
  const [path, setPath] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [justLit, setJustLit] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const steps = path.steps.filter((s): s is PathStep & { course: NonNullable<PathStep["course"]> } => s.course !== null);
  const order = steps.map((s) => s.course.slug);
  const states = starStates(
    steps.map((s) => ({ slug: s.course.slug, completed: s.completedAt !== null })),
    path.edges,
  );
  const next = nextStar(order, states);
  const [selected, setSelected] = useState<string | null>(next ?? order[0] ?? null);
  const current = steps.find((s) => s.course.slug === selected) ?? null;

  const progress = { completed: steps.filter((s) => s.completedAt).length, total: steps.length };
  const complete = progress.total > 0 && progress.completed === progress.total;
  const titleOf = (slug: string) => steps.find((s) => s.course.slug === slug)?.course.title ?? slug;
  const pendingPrereqs = (slug: string) =>
    path.edges.filter((e) => e.to === slug && states.get(e.from) !== "completed").map((e) => titleOf(e.from));

  async function toggle(step: (typeof steps)[number], force = false) {
    const completing = step.completedAt === null;
    if (completing && !force && pendingPrereqs(step.course.slug).length) {
      setConfirming(step.course.slug);
      return;
    }
    setConfirming(null);
    setError(null);
    const previous = path;
    const optimistic = completing ? new Date().toISOString() : null;
    setPath((p) => ({ ...p, steps: p.steps.map((s) => (s.id === step.id ? { ...s, completedAt: optimistic } : s)) }));
    if (completing) setJustLit(step.course.slug);
    try {
      const r = await setStepCompletion(path.id, step.id, completing);
      setPath((p) => ({
        ...p,
        progress: r.progress,
        steps: p.steps.map((s) => (s.id === step.id ? { ...s, completedAt: r.step.completedAt } : s)),
      }));
    } catch (err) {
      setPath(previous);
      setJustLit(null);
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el cambio. Inténtalo de nuevo.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold sm:text-3xl">{path.name}</h1>
          {path.status === "archived" && (
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink-muted">Archivada</span>
          )}
        </div>
        {path.goal && <p className="max-w-[70ch] text-ink-muted">“{path.goal}”</p>}
        <p className="flex flex-wrap items-center gap-3 text-sm font-medium" aria-live="polite">
          <StarRow progress={progress} />
          <span>{progressLabel(progress)}</span>
        </p>
      </header>

      <AnimatePresence>
        {complete && (
          <motion.p
            role="status"
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 rounded-lg bg-primary-soft px-5 py-4 font-medium"
          >
            <Star state="completed" size={26} glow />
            ¡Constelación completa! Encendiste todas las estrellas de esta ruta.
          </motion.p>
        )}
      </AnimatePresence>

      {error && (
        <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {/* Móvil: constelación → curso seleccionado → lista. Escritorio: el panel ocupa la columna derecha. */}
      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr] lg:grid-rows-[auto_1fr]">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <Constellation
            stars={steps.map((s) => ({
              slug: s.course.slug,
              title: s.course.title,
              position: s.position,
              state: states.get(s.course.slug)!,
              isNext: s.course.slug === next,
            }))}
            edges={path.edges}
            selected={selected}
            onSelect={setSelected}
            label={`Constelación de ${steps.length} cursos. ${progressLabel(progress)}. Usa la lista de pasos para navegarla.`}
            className="h-72 rounded-lg border border-line bg-surface/60 sm:h-[28rem]"
          />
        </div>

        <aside aria-label="Curso seleccionado" className="lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          {current ? (
            <CourseDetail
              key={current.id}
              step={current}
              state={states.get(current.course.slug)!}
              isNext={current.course.slug === next}
              lit={justLit === current.course.slug}
              confirming={confirming === current.course.slug}
              pendingPrereqs={pendingPrereqs(current.course.slug)}
              onToggle={(force) => toggle(current, force)}
              onCancel={() => setConfirming(null)}
            />
          ) : (
            <p className="text-ink-muted">Elige una estrella para ver el detalle.</p>
          )}
        </aside>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <section aria-labelledby="steps-title">
            <h2 id="steps-title" className="mb-3 font-semibold">
              Pasos en orden
            </h2>
            <ol className="flex flex-col divide-y divide-line rounded-lg border border-line">
              {steps.map((s) => {
                const state = states.get(s.course.slug)!;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(s.course.slug)}
                      aria-current={s.course.slug === selected ? "true" : undefined}
                      className={
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface " +
                        (s.course.slug === selected ? "bg-surface" : "")
                      }
                    >
                      <Star state={state} size={22} />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate font-medium ${state === "locked" ? "text-ink-muted" : ""}`}>
                          {s.position + 1}. {s.course.title}
                        </span>
                        <span className="text-xs text-ink-muted">
                          {STAR_LABEL[state]}
                          {s.course.slug === next ? " · siguiente" : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-ink-muted tabular-nums">{s.course.durationHours} h</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

      </div>
    </div>
  );
}

function CourseDetail({
  step,
  state,
  isNext,
  lit,
  confirming,
  pendingPrereqs,
  onToggle,
  onCancel,
}: {
  step: PathStep & { course: NonNullable<PathStep["course"]> };
  state: StarState;
  isNext: boolean;
  lit: boolean;
  confirming: boolean;
  pendingPrereqs: string[];
  onToggle: (force: boolean) => void;
  onCancel: () => void;
}) {
  const reduce = useReducedMotion();
  const { course } = step;
  const done = step.completedAt !== null;
  return (
    <article className="flex flex-col gap-5 rounded-lg border border-line p-5">
      <div className="flex items-start gap-4">
        <motion.span
          key={`${done}`}
          initial={lit && !reduce ? { scale: 0.4, rotate: -20 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-0.5"
        >
          <Star state={state} size={36} glow />
        </motion.span>
        <div className="min-w-0">
          <p className="text-sm text-ink-muted">
            Paso {step.position + 1} · {STAR_LABEL[state]}
            {isNext ? " · siguiente" : ""}
          </p>
          <h2 className="mt-0.5 text-xl leading-snug font-semibold">{course.title}</h2>
        </div>
      </div>

      <dl className="flex gap-6 text-sm">
        <div>
          <dt className="text-ink-muted">Nivel</dt>
          <dd className="font-medium">{LEVEL_LABEL[course.level]}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Duración</dt>
          <dd className="font-medium tabular-nums">{course.durationHours} h</dd>
        </div>
      </dl>

      {step.rationale && (
        <div className="rounded-md bg-surface px-4 py-3">
          <p className="text-sm font-medium">Por qué está en tu ruta</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">{step.rationale}</p>
        </div>
      )}

      <p className="text-sm leading-relaxed text-ink-muted">{course.summary}</p>

      {confirming ? (
        <div role="alert" className="flex flex-col gap-3 rounded-md border border-line-strong px-4 py-3">
          <p className="text-sm">
            Aún no completaste {pendingPrereqs.join(", ")}. ¿Estudiaste esto por tu cuenta?
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onToggle(true)}>
              Sí, marcarlo igual
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button variant={done ? "secondary" : "primary"} onClick={() => onToggle(false)} aria-pressed={done}>
            {done ? "Marcar como pendiente" : "Marcar como completado"}
          </Button>
          <a
            href={course.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-[0.9375rem] font-medium text-accent underline-offset-4 hover:underline"
          >
            Ver en DevTalles
            <span aria-hidden>↗</span>
            <span className="sr-only">(se abre en otra pestaña)</span>
          </a>
        </div>
      )}
      {lit && done && (
        <p role="status" className="text-sm font-medium text-primary-strong">
          ¡Estrella encendida!
        </p>
      )}
    </article>
  );
}
