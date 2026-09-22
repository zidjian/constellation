// Disposición en zigzag según el orden de la ruta: la figura siempre se lee como un recorrido,
// aunque los cursos no dependan entre sí. Determinista: misma ruta ⇒ misma figura.
export const NODE_HEIGHT = 76;
export const STAR_OFFSET_X = 25; // centro de la estrella dentro del nodo (padding + radio)

export interface Grid {
  columns: number;
  nodeWidth: number;
  /** Pantallas estrechas: solo estrella y número; el título está en la lista y el panel. */
  compact: boolean;
}

export const gridFor = (width: number): Grid =>
  width < 480
    ? { columns: 4, nodeWidth: 64, compact: true }
    : width < 760
      ? { columns: 3, nodeWidth: 168, compact: false }
      : { columns: 4, nodeWidth: 176, compact: false };

export function zigzagLayout(count: number, { columns, nodeWidth }: Grid) {
  const cellW = nodeWidth + (nodeWidth < 100 ? 12 : 20);
  const cellH = NODE_HEIGHT + 44;
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / columns);
    const inRow = i % columns;
    const col = row % 2 === 0 ? inRow : columns - 1 - inRow; // boustrofedón: el trazo no cruza la figura
    // Leve escalonado vertical: evita el aspecto de tabla sin perder legibilidad.
    return { x: col * cellW, y: row * cellH + (col % 2 === 1 ? 22 : 0) };
  });
}
