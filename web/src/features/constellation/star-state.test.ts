import { describe, expect, it } from "vitest";
import { nextStar, starStates } from "./star-state";
import { layoutSky } from "./sky-map";

describe("starStates", () => {
  const edges = [
    { from: "js", to: "ts" },
    { from: "ts", to: "nest" },
  ];

  it("un curso con prerrequisitos pendientes está bloqueado", () => {
    const states = starStates(
      [
        { slug: "js", completed: false },
        { slug: "ts", completed: false },
        { slug: "nest", completed: false },
      ],
      edges,
    );
    expect([...states.values()]).toEqual(["available", "locked", "locked"]);
  });

  it("completar un curso desbloquea el siguiente", () => {
    const states = starStates(
      [
        { slug: "js", completed: true },
        { slug: "ts", completed: false },
        { slug: "nest", completed: false },
      ],
      edges,
    );
    expect(states.get("js")).toBe("completed");
    expect(states.get("ts")).toBe("available");
    expect(states.get("nest")).toBe("locked");
  });

  it("sin prerrequisitos, todo está disponible", () => {
    const states = starStates([{ slug: "docker", completed: false }], []);
    expect(states.get("docker")).toBe("available");
  });

  it("la siguiente estrella es la primera disponible en el orden de la ruta", () => {
    const order = ["js", "ts", "nest"];
    const states = starStates(
      [
        { slug: "js", completed: true },
        { slug: "ts", completed: false },
        { slug: "nest", completed: false },
      ],
      edges,
    );
    expect(nextStar(order, states)).toBe("ts");
    expect(nextStar([], states)).toBeNull();
  });
});

describe("layoutSky", () => {
  it("recorre las filas en zigzag para que el trazo no cruce la figura", () => {
    // 6 estrellas a 4 columnas: la segunda fila vuelve de derecha a izquierda.
    const { nodes } = layoutSky(6, 900, false);
    const fila0 = nodes.slice(0, 4).map((n) => n.x);
    const fila1 = nodes.slice(4).map((n) => n.x);
    expect(fila0).toEqual([...fila0].sort((a, b) => a - b));
    expect(fila1).toEqual([...fila1].sort((a, b) => b - a));
    expect(nodes[4].y).toBeGreaterThan(nodes[0].y);
  });

  it("es determinista: misma entrada, misma figura", () => {
    expect(layoutSky(8, 1024, false)).toEqual(layoutSky(8, 1024, false));
  });

  it("la miniatura no reserva espacio para los títulos", () => {
    const grande = layoutSky(4, 400, false);
    const mini = layoutSky(4, 400, true);
    expect(mini.height).toBeLessThan(grande.height);
    expect(mini.starSize).toBeLessThan(grande.starSize);
  });

  it("en pantallas estrechas usa menos columnas", () => {
    const estrecho = layoutSky(6, 390, false);
    const ancho = layoutSky(6, 1200, false);
    expect(estrecho.height).toBeGreaterThan(ancho.height);
  });
});
