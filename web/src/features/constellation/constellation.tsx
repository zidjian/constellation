"use client";

import {
  type Edge,
  type EdgeProps,
  Handle,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useInternalNode,
  useNodesInitialized,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Star, STAR_LABEL, type StarState } from "@/components/ui/star";
import { type Grid, gridFor, NODE_HEIGHT, STAR_OFFSET_X, zigzagLayout } from "./layout";

// `type` y no `interface`: React Flow exige que `data` encaje en Record<string, unknown>.
export type ConstellationStar = {
  slug: string;
  title: string;
  state: StarState;
  position: number;
  isNext?: boolean;
};

interface Props {
  stars: ConstellationStar[];
  /** Prerrequisitos reales entre cursos de la ruta. */
  edges: { from: string; to: string }[];
  selected?: string | null;
  onSelect?: (slug: string) => void;
  /** Descripción para lectores de pantalla; la lista de pasos es la alternativa navegable. */
  label: string;
  className?: string;
}

type StarNodeData = ConstellationStar & { width: number; compact: boolean; selected: boolean; onSelect?: (slug: string) => void };

function StarNode({ data }: NodeProps<Node<StarNodeData>>) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{ width: data.width, height: NODE_HEIGHT }}
      className="flex items-center"
    >
      <Handle type="target" position={Position.Left} className="!opacity-0" isConnectable={false} />
      <button
        type="button"
        onClick={() => data.onSelect?.(data.slug)}
        aria-pressed={data.selected}
        aria-label={`${data.position + 1}. ${data.title} — ${STAR_LABEL[data.state]}${data.isNext ? " · siguiente" : ""}`}
        className={
          "nodrag nopan flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left " +
          "transition-[background-color,box-shadow] duration-150 ease-out-quint hover:bg-bg " +
          (data.selected ? "bg-bg shadow-[inset_0_0_0_1.5px_var(--color-accent)]" : "")
        }
      >
        <span className={`relative rounded-full bg-bg ${data.isNext ? "animate-star-pulse" : ""}`}>
          <Star state={data.state} size={30} glow />
        </span>
        {data.compact ? (
          <span className="text-xs font-semibold tabular-nums text-ink-muted">{data.position + 1}</span>
        ) : (
          // Fondo propio: las líneas pasan por detrás del nodo y no deben tachar el texto.
          <span className="min-w-0 rounded-md bg-surface/90 px-1 py-0.5">
            <span
              className={`line-clamp-2 text-[0.8125rem] leading-snug font-medium ${data.state === "locked" ? "text-ink-muted" : "text-ink"}`}
            >
              {data.title}
            </span>
            {data.isNext && <span className="text-xs font-medium text-accent">Siguiente</span>}
          </span>
        )}
      </button>
      <Handle type="source" position={Position.Right} className="!opacity-0" isConnectable={false} />
    </motion.div>
  );
}

/** Línea recta de estrella a estrella (como en una constelación), recortada al borde de cada una. */
function StraightEdge({ source, target, data }: EdgeProps<Edge<{ kind: "prerequisite" | "sequence"; lit: boolean }>>) {
  const reduce = useReducedMotion();
  const a = useInternalNode(source);
  const b = useInternalNode(target);
  if (!a || !b) return null;
  const ax = a.internals.positionAbsolute.x + STAR_OFFSET_X;
  const ay = a.internals.positionAbsolute.y + NODE_HEIGHT / 2;
  const bx = b.internals.positionAbsolute.x + STAR_OFFSET_X;
  const by = b.internals.positionAbsolute.y + NODE_HEIGHT / 2;
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const r = 17; // radio de la estrella + aire
  const [ux, uy] = [(bx - ax) / len, (by - ay) / len];
  const d = `M ${ax + ux * r} ${ay + uy * r} L ${bx - ux * r} ${by - uy * r}`;
  const prerequisite = data?.kind === "prerequisite";
  const lit = Boolean(data?.lit);
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={prerequisite ? (lit ? "var(--color-accent)" : "var(--color-star-off)") : "var(--color-line-strong)"}
      strokeWidth={prerequisite ? 2 : 1.5}
      strokeDasharray={prerequisite ? undefined : "2 6"}
      strokeLinecap="round"
      initial={reduce || !prerequisite ? { opacity: 0 } : { pathLength: 0, opacity: 1 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: prerequisite ? 0.5 : 0.3, ease: [0.16, 1, 0.3, 1] }}
    />
  );
}

const nodeTypes = { star: StarNode };
const edgeTypes = { straight: StraightEdge };

function Graph({ stars, edges, selected, onSelect, grid }: Props & { grid: Grid }) {
  const flow = useReactFlow();
  const initialized = useNodesInitialized();

  const { nodes, flowEdges } = useMemo(() => {
    const ordered = [...stars].sort((a, b) => a.position - b.position);
    const positions = zigzagLayout(ordered.length, grid);
    const bySlug = new Map(ordered.map((s) => [s.slug, s]));
    const prereq = edges.filter((e) => bySlug.has(e.from) && bySlug.has(e.to));
    const linked = new Set(prereq.map((e) => `${e.from}>${e.to}`));
    // Orden sugerido: une pasos consecutivos cuando no hay ya un prerrequisito entre ellos.
    const sequence = ordered
      .slice(1)
      .map((s, i) => ({ from: ordered[i].slug, to: s.slug }))
      .filter((e) => !linked.has(`${e.from}>${e.to}`));
    return {
      nodes: ordered.map(
        (s, i): Node<StarNodeData> => ({
          id: s.slug,
          type: "star",
          position: positions[i],
          data: { ...s, width: grid.nodeWidth, compact: grid.compact, selected: s.slug === selected, onSelect },
          draggable: false,
          selectable: false,
          focusable: false,
        }),
      ),
      flowEdges: [
        ...sequence.map((e) => ({ ...e, kind: "sequence" as const })),
        ...prereq.map((e) => ({ ...e, kind: "prerequisite" as const })),
      ].map(
        (e): Edge<{ kind: "prerequisite" | "sequence"; lit: boolean }> => ({
          id: `${e.kind}:${e.from}->${e.to}`,
          source: e.from,
          target: e.to,
          type: "straight",
          data: { kind: e.kind, lit: bySlug.get(e.from)!.state === "completed" },
          focusable: false,
        }),
      ),
    };
  }, [stars, edges, grid, selected, onSelect]);

  // Re-encuadre cuando la figura crece (stream). El encuadre inicial lo hace `fitView` al montar,
  // ya con la rejilla correcta porque el grafo no se monta hasta conocer el ancho.
  useEffect(() => {
    if (!initialized) return;
    const id = setTimeout(() => void flow.fitView({ padding: 0.06, duration: 250, maxZoom: 1 }), 60);
    return () => clearTimeout(id);
  }, [flow, initialized, stars.length]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={flowEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnScroll={false}
      zoomOnScroll={false}
      zoomOnPinch
      zoomOnDoubleClick={false}
      preventScrolling={false}
      minZoom={0.4}
      maxZoom={1.4}
      fitView
      fitViewOptions={{ padding: 0.06, maxZoom: 1 }}
      proOptions={{ hideAttribution: true }}
    />
  );
}

/** Mide el contenedor y monta el grafo con la rejilla adecuada; si cambia la rejilla, lo remonta. */
function Measured(props: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [grid, setGrid] = useState<Grid | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const next = gridFor(entry.contentRect.width);
      setGrid((g) => (g && g.columns === next.columns && g.nodeWidth === next.nodeWidth && g.compact === next.compact ? g : next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const key = grid ? `${grid.columns}-${grid.nodeWidth}` : "none";
  return (
    <div ref={ref} role="group" aria-label={props.label} className="h-full w-full">
      {grid && (
        <ReactFlowProvider key={key}>
          <Graph {...props} grid={grid} />
        </ReactFlowProvider>
      )}
    </div>
  );
}

export function Constellation(props: Props) {
  return (
    <div className={`flex flex-col ${props.className ?? ""}`}>
      <div className="min-h-0 flex-1">
        <Measured {...props} />
      </div>
      <p aria-hidden className="flex flex-wrap gap-x-5 gap-y-1 px-4 pb-3 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-2">
          <svg width="22" height="6">
            <line x1="1" y1="3" x2="21" y2="3" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Prerrequisito
        </span>
        <span className="inline-flex items-center gap-2">
          <svg width="22" height="6">
            <line x1="1" y1="3" x2="21" y2="3" stroke="var(--color-line-strong)" strokeWidth="1.5" strokeDasharray="2 6" strokeLinecap="round" />
          </svg>
          Orden sugerido
        </span>
      </p>
    </div>
  );
}
