import { describe, expect, it } from "vitest";
import { nextStar, starStates } from "./star-state";
import { gridFor, zigzagLayout } from "./layout";

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

describe("zigzagLayout", () => {
  it("recorre las filas en zigzag para que el trazo no cruce la figura", () => {
    const grid = { columns: 3, nodeWidth: 168, compact: false };
    const p = zigzagLayout(6, grid);
    expect(p[0].x).toBeLessThan(p[1].x); // fila 0: izquierda a derecha
    expect(p[2].x).toBeGreaterThan(p[1].x);
    expect(p[3].x).toBe(p[2].x); // fila 1 empieza donde terminó la 0
    expect(p[4].x).toBeLessThan(p[3].x); // y va de derecha a izquierda
    expect(p[3].y).toBeGreaterThan(p[0].y);
  });

  it("es determinista: la misma ruta produce la misma figura", () => {
    const grid = gridFor(1024);
    expect(zigzagLayout(8, grid)).toEqual(zigzagLayout(8, grid));
  });

  it("en pantallas estrechas usa el modo compacto", () => {
    expect(gridFor(390).compact).toBe(true);
    expect(gridFor(700).compact).toBe(false);
  });
});
