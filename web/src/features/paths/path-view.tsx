"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Star, STAR_LABEL, type StarState } from "@/components/ui/star";
import { SkyLegend, SkyMap } from "@/features/constellation/sky-map";
import { nextStar, starStates } from "@/features/constellation/star-state";
import { ApiError } from "@/lib/api";
import { setStepCompletion } from "./api";
import { hoursLabel, LightBar, progressLabel } from "./light-bar";
import { LEVEL_LABEL, type PathDetail, type PathStep } from "./types";

type Step = PathStep & { course: NonNullable<PathStep["course"]> };

export function PathView({ initial }: { initial: PathDetail }) {
  const reduce = useReducedMotion();
  const [path, setPath] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [justLit, setJustLit] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const steps = path.steps.filter((s): s is Step => s.course !== null);
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
  const remaining = steps.filter((s) => !s.completedAt).reduce((h, s) => h + s.course.durationHours, 0);
  const total = steps.reduce((h, s) => h + s.course.durationHours, 0);
  const titleOf = (slug: string) => steps.find((s) => s.course.slug === slug)?.course.title ?? slug;
  const pendingPrereqs = (slug: string) =>
    path.edges.filter((e) => e.to === slug && states.get(e.from) !== "completed").map((e) => titleOf(e.from));

  // El aviso de "estrella encendida" se va solo: es una celebración, no un estado.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  async function toggle(step: Step, force = false) {
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
    if (completing) {
      setJustLit(step.course.slug);
      const left = progress.total - progress.completed - 1;
      setToast(
        left === 0
          ? "¡Constelación completa!"
          : `Estrella ${progress.completed + 1} encendida · ${left === 1 ? "queda 1" : `quedan ${left}`}`,
      );
    }
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
      setToast(null);
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el cambio. Inténtalo de nuevo.");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Cabecera fina: el nombre, lo que llevas y lo que falta. Nada de bloque de título. */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold sm:text-2xl">{path.name}</h1>
          {path.status === "archived" && (
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink-muted">Archivada</span>
          )}
          {path.goal && <p className="min-w-0 truncate text-sm text-ink-muted">“{path.goal}”</p>}
        </div>
        <div className="flex flex-col gap-2">
          <LightBar progress={progress} />
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums" aria-live="polite">
            <span className="font-medium">{progressLabel(progress)}</span>
            <span aria-hidden className="text-line-strong">
              ·
            </span>
            <span className="text-ink-muted">
              {complete ? `${hoursLabel(total)} invertidas` : `${hoursLabel(remaining)} restantes de ${hoursLabel(total)}`}
            </span>
          </p>
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {/* El lienzo manda: ocupa la columna ancha y el detalle vive al lado, no dentro de otra tarjeta. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(320px,1fr)]">
        <section aria-labelledby="mapa-title" className="flex min-w-0 flex-col gap-3">
          <h2 id="mapa-title" className="sr-only">
            Constelación de la ruta
          </h2>
          <div className="rounded-xl border border-line bg-surface/50 px-4 py-6 sm:px-6 sm:py-8">
            <SkyMap
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
              justLit={justLit}
              label={`Constelación de ${steps.length} cursos. ${progressLabel(progress)}. Debajo tienes los mismos pasos en una lista.`}
            />
          </div>
          <SkyLegend className="px-1" />

          <StepRail
            steps={steps}
            states={states}
            next={next}
            selected={selected}
            onSelect={setSelected}
          />
        </section>

        <aside aria-label="Curso seleccionado" className="lg:sticky lg:top-20 lg:self-start">
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
      </div>

      {/* Celebración: aparece sobre el contenido y se va sola. */}
      <AnimatePresence>
        {toast && (
          <motion.p
            role="status"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduce ? 0 : 8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-4 bottom-6 z-(--z-toast) mx-auto flex w-fit items-center gap-3 rounded-full border border-line bg-surface-2 px-5 py-3 text-sm font-medium shadow-[0_0_30px_-10px_var(--color-glow)]"
          >
            <Star state="completed" size={20} glow />
            {toast}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Riel de pasos: sustituye a la lista que duplicaba el grafo. Cada ficha trae el porqué, que es lo
 * que la lista anterior no contaba. Es `<ol>`, así que sigue siendo la alternativa accesible.
 */
function StepRail({
  steps,
  states,
  next,
  selected,
  onSelect,
}: {
  steps: Step[];
  states: Map<string, StarState>;
  next: string | null;
  selected: string | null;
  onSelect: (slug: string) => void;
}) {
  const ref = useRef<HTMLOListElement>(null);

  // Al elegir una estrella en el lienzo, su ficha se trae a la vista.
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[data-selected="true"]');
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [selected]);

  return (
    <section aria-labelledby="pasos-title" className="min-w-0">
      <h2 id="pasos-title" className="mb-2 text-sm font-medium text-ink-muted">
        Pasos en orden
      </h2>
      <ol
        ref={ref}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-2 lg:snap-none lg:overflow-visible xl:grid-cols-3"
      >
        {steps.map((s) => {
          const state = states.get(s.course.slug)!;
          const isSelected = s.course.slug === selected;
          return (
            <li key={s.id} className="w-[17rem] shrink-0 snap-start lg:w-auto">
              <button
                type="button"
                onClick={() => onSelect(s.course.slug)}
                data-selected={isSelected}
                aria-current={isSelected ? "true" : undefined}
                className={
                  "flex h-full w-full flex-col gap-2 rounded-lg border px-4 py-3 text-left " +
                  "transition-[background-color,border-color] duration-150 ease-out-quint hover:border-line-strong " +
                  (isSelected ? "border-accent bg-surface" : "border-line bg-surface/40")
                }
              >
                <span className="flex items-start gap-2.5">
                  <Star state={state} size={20} />
                  <span className="line-clamp-2 min-w-0 flex-1 text-[0.9375rem] leading-snug font-medium">
                    <span className="tabular-nums text-ink-muted">{s.position + 1}. </span>
                    {s.course.title}
                  </span>
                  <span className="mt-0.5 shrink-0 text-xs text-ink-muted tabular-nums">
                    {hoursLabel(s.course.durationHours)}
                  </span>
                </span>
                <span className="text-xs text-ink-muted">
                  {s.course.slug === next ? (
                    <span className="font-medium text-accent">Empieza por aquí</span>
                  ) : (
                    STAR_LABEL[state]
                  )}
                </span>
                {s.rationale && <span className="line-clamp-2 text-xs leading-relaxed text-ink-muted">{s.rationale}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
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
  step: Step;
  state: StarState;
  isNext: boolean;
  lit: boolean;
  confirming: boolean;
  pendingPrereqs: string[];
  onToggle: (force: boolean) => void;
  onCancel: () => void;
}) {
  const reduce = useReducedMotion();
  const [showSummary, setShowSummary] = useState(false);
  const { course } = step;
  const done = step.completedAt !== null;

  return (
    <article className="flex flex-col gap-5 rounded-xl border border-line bg-surface px-5 py-5">
      <div className="flex items-start gap-3.5">
        <motion.span
          key={`${done}`}
          initial={lit && !reduce ? { scale: 0.4, rotate: -20 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-0.5"
        >
          <Star state={state} size={34} glow={lit} />
        </motion.span>
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
            Paso {step.position + 1}
            {isNext ? " · siguiente" : ""}
          </p>
          <h2 className="mt-1 text-lg leading-snug font-semibold">{course.title}</h2>
        </div>
      </div>

      {/* El porqué va primero: es lo que hace que la ruta se entienda, no un extra. */}
      {step.rationale && (
        <div>
          <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">Por qué está en tu ruta</p>
          <p className="mt-1.5 leading-relaxed">{step.rationale}</p>
        </div>
      )}

      <dl className="flex gap-6 border-t border-line pt-4 text-sm">
        <div>
          <dt className="text-ink-muted">Nivel</dt>
          <dd className="mt-0.5 font-medium">{LEVEL_LABEL[course.level]}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Duración</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{hoursLabel(course.durationHours)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Estado</dt>
          <dd className="mt-0.5 font-medium">{STAR_LABEL[state]}</dd>
        </div>
      </dl>

      <div>
        <button
          type="button"
          onClick={() => setShowSummary((v) => !v)}
          aria-expanded={showSummary}
          className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          {showSummary ? "Ocultar descripción" : "Ver descripción del curso"}
        </button>
        {showSummary && <p className="mt-2 text-sm leading-relaxed text-ink-muted">{course.summary}</p>}
      </div>

      {confirming ? (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-line-strong bg-surface-2 px-4 py-3">
          <p className="text-sm">Aún no completaste {pendingPrereqs.join(", ")}. ¿Estudiaste esto por tu cuenta?</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onToggle(true)}>
              Sí, encenderla igual
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {/* El único ámbar de la interfaz: encender es lo que emite luz. */}
          <Button variant={done ? "secondary" : "primary"} onClick={() => onToggle(false)} aria-pressed={done}>
            {done ? "Apagar esta estrella" : "Encender esta estrella"}
          </Button>
          <a
            href={course.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-1.5 rounded-md px-1 text-[0.9375rem] font-medium text-accent underline-offset-4 hover:underline"
          >
            Abrir en DevTalles
            <span aria-hidden>↗</span>
            <span className="sr-only">(se abre en otra pestaña)</span>
          </a>
        </div>
      )}
    </article>
  );
}
