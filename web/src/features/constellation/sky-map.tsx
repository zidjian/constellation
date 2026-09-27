"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Star, STAR_LABEL, type StarState } from "@/components/ui/star";

/**
 * Lienzo propio de la constelación (sustituye a React Flow, ver specs/06).
 *
 * Las líneas van en un <svg> de fondo y las estrellas son botones HTML posicionados encima: así el
 * título se corta con CSS (nunca a mitad de palabra ni pisado por una línea, que era el defecto
 * visible del lienzo anterior) y cada estrella es un control nativo con teclado y aria.
 *
 * La disposición es determinista: zigzag por filas (boustrofedón), misma ruta ⇒ misma figura.
 */

export interface SkyStar {
  slug: string;
  title: string;
  position: number;
  state: StarState;
  isNext?: boolean;
}

interface Props {
  stars: SkyStar[];
  /** Prerrequisitos reales entre cursos de la ruta. */
  edges: { from: string; to: string }[];
  selected?: string | null;
  onSelect?: (slug: string) => void;
  /** Estrella recién encendida: solo esa recibe el brillo. */
  justLit?: string | null;
  /** Descripción para lectores de pantalla; la lista de pasos es la alternativa navegable. */
  label: string;
  className?: string;
  /** Miniatura: sin títulos ni interacción (tarjetas del cielo de rutas). */
  mini?: boolean;
  /** Estrellas sueltas, sin trazo: el estado previo a que exista la ruta. */
  lines?: boolean;
}

const GAP_X = 24;
const STAR_SIZE = 40;
const LABEL_H = 40;
const ROW_GAP = 34;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function layoutSky(count: number, width: number, mini: boolean) {
  const columns = mini ? Math.min(count, 6) : width < 420 ? 2 : width < 680 ? 3 : width < 1000 ? 4 : 5;
  const starSize = mini ? 14 : STAR_SIZE;
  const labelH = mini ? 0 : LABEL_H;
  const gap = mini ? 10 : GAP_X;
  const cols = Math.max(1, columns);
  const nodeW = Math.max(mini ? 14 : 92, (width - gap * (cols - 1)) / cols);
  const cellH = starSize + labelH + (mini ? 14 : ROW_GAP);
  const rows = Math.max(1, Math.ceil(count / cols));

  const nodes = Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / cols);
    const inRow = i % cols;
    // Boustrofedón: el recorrido baja serpenteando y el trazo nunca cruza la figura.
    const col = row % 2 === 0 ? inRow : cols - 1 - inRow;
    const x = col * (nodeW + gap);
    const y = row * cellH;
    return { x, y, w: nodeW, cx: x + nodeW / 2, cy: y + starSize / 2 };
  });

  return { nodes, starSize, height: rows * cellH - (mini ? 14 : ROW_GAP) + 4 };
}

/** Recorta la línea al borde de cada estrella para que no salga de debajo del disco. */
function trim(a: { cx: number; cy: number }, b: { cx: number; cy: number }, r: number) {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return { x1: a.cx + ux * r, y1: a.cy + uy * r, x2: b.cx - ux * r, y2: b.cy - uy * r };
}

export function SkyMap({ stars, edges, selected, onSelect, justLit, label, className = "", mini = false, lines: drawLines = true }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const reduce = useReducedMotion();

  const ordered = useMemo(() => [...stars].sort((a, b) => a.position - b.position), [stars]);

  const { nodes, starSize, height } = useMemo(
    () => layoutSky(ordered.length, width || 600, mini),
    [ordered.length, width, mini],
  );

  const lines = useMemo(() => {
    if (!drawLines) return [];
    const index = new Map(ordered.map((s, i) => [s.slug, i]));
    const prereq = edges.filter((e) => index.has(e.from) && index.has(e.to));
    const linked = new Set(prereq.map((e) => `${e.from}>${e.to}`));
    // Orden sugerido: une pasos consecutivos cuando no hay ya un prerrequisito entre ellos.
    const sequence = ordered
      .slice(1)
      .map((s, i) => ({ from: ordered[i].slug, to: s.slug }))
      .filter((e) => !linked.has(`${e.from}>${e.to}`));
    return [
      ...sequence.map((e) => ({ ...e, kind: "sequence" as const })),
      ...prereq.map((e) => ({ ...e, kind: "prerequisite" as const })),
    ].map((e) => {
      const from = nodes[index.get(e.from)!];
      const to = nodes[index.get(e.to)!];
      return {
        id: `${e.kind}:${e.from}->${e.to}`,
        kind: e.kind,
        lit: ordered[index.get(e.from)!].state === "completed",
        ...trim(from, to, starSize / 2 + 3),
      };
    });
  }, [ordered, edges, nodes, starSize, drawLines]);

  return (
    <div
      ref={ref}
      // Interactivo: las estrellas son botones, así que es un grupo, no una imagen (nested-interactive).
      role={mini ? "img" : "group"}
      aria-label={label}
      className={`relative ${className}`}
      style={{ height: mini ? height : undefined, minHeight: mini ? undefined : height }}
    >
      <svg aria-hidden className="pointer-events-none absolute inset-0 size-full overflow-visible">
        {lines.map((l, i) => (
          <motion.line
            key={l.id}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke={l.lit ? "var(--color-primary)" : "var(--color-line-strong)"}
            strokeWidth={l.kind === "prerequisite" ? (l.lit ? 2 : 1.5) : 1.25}
            strokeDasharray={l.kind === "sequence" && !mini ? "2 6" : undefined}
            strokeLinecap="round"
            opacity={l.kind === "sequence" && !mini ? 0.75 : 1}
            initial={reduce || mini ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: l.kind === "sequence" && !mini ? 0.75 : 1 }}
            transition={{ duration: 0.45, delay: mini ? 0 : 0.12 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
      </svg>

      {ordered.map((s, i) => {
        const n = nodes[i];
        const isSelected = s.slug === selected;
        return (
          <motion.div
            key={s.slug}
            className="absolute"
            style={{ left: n.x, top: n.y, width: n.w }}
            initial={reduce || mini ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, delay: mini ? 0 : i * 0.05, ease: [0.22, 1, 0.36, 1] }}
          >
            {mini ? (
              <span className="flex justify-center">
                <Star state={s.state} size={starSize} />
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onSelect?.(s.slug)}
                aria-pressed={isSelected}
                aria-label={`${s.position + 1}. ${s.title} — ${STAR_LABEL[s.state]}${s.isNext ? " · siguiente" : ""}`}
                className={
                  "group flex w-full flex-col items-center gap-2 rounded-lg px-1 pt-1 pb-1.5 text-center " +
                  "transition-[background-color,box-shadow] duration-150 ease-out-quint hover:bg-surface " +
                  (isSelected ? "bg-surface shadow-[inset_0_0_0_1.5px_var(--color-accent)]" : "")
                }
              >
                <span className={`relative flex rounded-full bg-bg ${s.isNext ? "star-pulse" : ""}`}>
                  <Star state={s.state} size={starSize} glow={s.slug === justLit} />
                </span>
                <span className="w-full">
                  <span
                    className={
                      "line-clamp-2 text-[0.8125rem] leading-tight font-medium " +
                      (s.state === "locked" ? "text-ink-muted" : "text-ink")
                    }
                  >
                    <span className="tabular-nums text-ink-muted">{s.position + 1}. </span>
                    {s.title}
                  </span>
                </span>
              </button>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

/** Leyenda de los dos tipos de línea. Va fuera del lienzo para no competir con la figura. */
export function SkyLegend({ className = "" }: { className?: string }) {
  return (
    <p className={`flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-muted ${className}`}>
      <span className="flex items-center gap-2">
        <svg aria-hidden width="22" height="8" className="shrink-0">
          <line x1="1" y1="4" x2="21" y2="4" stroke="var(--color-line-strong)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Prerrequisito
      </span>
      <span className="flex items-center gap-2">
        <svg aria-hidden width="22" height="8" className="shrink-0">
          <line
            x1="1"
            y1="4"
            x2="21"
            y2="4"
            stroke="var(--color-line-strong)"
            strokeWidth="1.25"
            strokeDasharray="2 6"
            strokeLinecap="round"
          />
        </svg>
        Orden sugerido
      </span>
      <span className="flex items-center gap-2">
        <svg aria-hidden width="22" height="8" className="shrink-0">
          <line x1="1" y1="4" x2="21" y2="4" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Ya encendido
      </span>
    </p>
  );
}
