// Verifica el contraste de los pares que de verdad usamos, leyendo los tokens de globals.css.
// En oscuro es fácil colar un gris bonito que no llega a AA: esto lo caza antes del navegador.
// Uso: node scripts/check-contrast.mjs   (sale ≠ 0 si algún par falla)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(fileURLToPath(new URL("../src/app/globals.css", import.meta.url)), "utf8");

const tokens = new Map();
for (const [, name, value] of css.matchAll(/--color-([a-z0-9-]+):\s*(oklch\([^)]+\))/g)) tokens.set(name, value);

// --- OKLCH → sRGB lineal → luminancia relativa (WCAG 2.x) ---------------------------------------
function oklchToLinearRgb(str) {
  const [l, c, h] = str
    .slice(6, -1)
    .split("/")[0]
    .trim()
    .split(/\s+/)
    .map(Number);
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const luminance = (name) => {
  const [r, g, b] = oklchToLinearRgb(tokens.get(name)).map((v) => Math.min(1, Math.max(0, v)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

// --- Pares reales de la interfaz ----------------------------------------------------------------
// min: 4.5 texto normal · 3 texto grande y elementos gráficos (WCAG 2.2 AA)
const PAIRS = [
  ["ink", "bg", 4.5, "texto principal"],
  ["ink", "surface", 4.5, "texto en panel"],
  ["ink", "surface-2", 4.5, "texto en panel elevado"],
  ["ink-muted", "bg", 4.5, "texto secundario"],
  ["ink-muted", "surface", 4.5, "texto secundario en panel"],
  ["primary", "bg", 3, "estrella encendida (gráfico)"],
  ["primary", "surface", 3, "estrella encendida en panel"],
  ["primary-strong", "bg", 4.5, "texto ámbar"],
  ["primary-strong", "surface", 4.5, "texto ámbar en panel"],
  ["accent", "bg", 3, "estrella disponible y foco"],
  ["accent", "surface", 3, "foco sobre panel"],
  ["accent", "surface-2", 3, "foco sobre panel elevado"],
  ["ink-inverse", "primary", 4.5, "texto del botón de encender"],
  ["ink-inverse", "accent", 4.5, "texto del botón de acción"],
  ["danger", "bg", 4.5, "mensaje de error"],
  ["danger", "danger-soft", 4.5, "error sobre su fondo"],
  ["success", "bg", 4.5, "confirmación"],
  ["star-off", "bg", 3, "estrella bloqueada (gráfico)"],
  ["star-off", "surface", 3, "estrella bloqueada en panel"],
  ["line-strong", "bg", 3, "borde de control"],
];

let fallos = 0;
for (const [fg, bg, min, uso] of PAIRS) {
  if (!tokens.has(fg) || !tokens.has(bg)) {
    console.log(`?  ${fg} / ${bg} — token inexistente`);
    fallos++;
    continue;
  }
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"}  ${`${fg} / ${bg}`.padEnd(30)} ${r.toFixed(2).padStart(6)}:1  (mín. ${min})  ${uso}`);
}

console.log(fallos ? `\n${fallos} par(es) por debajo del mínimo.` : `\n${PAIRS.length} pares verificados, todos en AA.`);
process.exit(fallos ? 1 : 0);
