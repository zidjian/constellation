import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Lógica pura de la web (estados de la constelación, layout, lector SSE). Los componentes se
// verifican con Chrome headless (ver web/CLAUDE.md).
export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node" },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
