#!/usr/bin/env node
// Valida el catálogo curado (catalog.json) de DevTalles Constellation.
// Sin dependencias: Node >= 20. La lógica vive en funciones exportadas para reutilizarla en el seed de Nest.
//
//   node tools/catalog/validate-catalog.mjs [ruta]   (por defecto: api/src/catalog/infrastructure/seed/catalog.json)
//
// Sale con código 1 si hay errores. Los avisos (warnings) no hacen fallar la validación.

import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const AREAS = Object.freeze(['fundamentals', 'frontend', 'backend', 'mobile', 'devops']);
export const LEVELS = Object.freeze(['beginner', 'intermediate', 'advanced']);
export const COURSE_URL_PREFIX = 'https://cursos.devtalles.com/courses/';

// Los slugs de curso son los de la URL real de DevTalles: pueden llevar mayúsculas, "_" y "%XX" (p. ej. NestJS-Testing).
const COURSE_SLUG = /^[A-Za-z0-9][A-Za-z0-9_%-]*$/;
// Los slugs de skill son nuestros: kebab-case en minúsculas.
const SKILL_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION = /^\d{4}-\d{2}-\d{2}$/;

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

function duplicates(values) {
  const seen = new Set();
  const dup = new Set();
  for (const v of values) (seen.has(v) ? dup : seen).add(v);
  return [...dup];
}

/**
 * Mapa slug de curso -> lista de slugs de prerrequisitos. Ignora referencias inexistentes y
 * autoprerrequisitos (validateCatalog los reporta aparte), así que solo contiene aristas reales.
 */
export function prerequisiteGraph(catalog) {
  const slugs = new Set(catalog.courses.map((c) => c.slug));
  return new Map(
    catalog.courses.map((c) => [
      c.slug,
      [...new Set(Array.isArray(c.prerequisites) ? c.prerequisites : [])].filter((p) => p !== c.slug && slugs.has(p)),
    ]),
  );
}

/**
 * Busca un ciclo en el grafo de prerrequisitos (DFS iterativo con colores).
 * Devuelve el ciclo como lista de slugs [a, b, ..., a] o null si el grafo es un DAG.
 */
export function findCycle(graph) {
  const WHITE = 0, GREY = 1, BLACK = 2;
  const color = new Map([...graph.keys()].map((k) => [k, WHITE]));
  const parent = new Map();
  for (const start of graph.keys()) {
    if (color.get(start) !== WHITE) continue;
    const stack = [[start, 0]];
    color.set(start, GREY);
    while (stack.length) {
      const frame = stack.at(-1);
      const [node, i] = frame;
      const next = graph.get(node) ?? [];
      if (i >= next.length) {
        color.set(node, BLACK);
        stack.pop();
        continue;
      }
      frame[1] = i + 1;
      const child = next[i];
      if (!graph.has(child)) continue;
      if (color.get(child) === GREY) {
        const cycle = [child];
        for (let n = node; n !== child; n = parent.get(n)) cycle.push(n);
        cycle.push(child);
        // cycle queda como [x, ..., x] donde cada elemento es prerrequisito del anterior al invertirlo.
        return cycle.reverse();
      }
      if (color.get(child) === WHITE) {
        parent.set(child, node);
        color.set(child, GREY);
        stack.push([child, 0]);
      }
    }
  }
  return null;
}

/** Orden topológico (prerrequisitos antes). Lanza si hay ciclo. Desempate estable por slug. */
export function topologicalOrder(graph) {
  const indegree = new Map([...graph.keys()].map((k) => [k, 0]));
  const dependents = new Map([...graph.keys()].map((k) => [k, []]));
  for (const [course, prereqs] of graph) {
    for (const p of prereqs) {
      indegree.set(course, indegree.get(course) + 1);
      dependents.get(p).push(course);
    }
  }
  const ready = [...graph.keys()].filter((k) => indegree.get(k) === 0).sort();
  const order = [];
  while (ready.length) {
    const n = ready.shift();
    order.push(n);
    for (const d of dependents.get(n)) {
      indegree.set(d, indegree.get(d) - 1);
      if (indegree.get(d) === 0) {
        ready.push(d);
        ready.sort();
      }
    }
  }
  if (order.length !== graph.size) throw new Error('El grafo de prerrequisitos tiene un ciclo');
  return order;
}

/** Todos los ancestros (prerrequisitos transitivos) de un curso. */
export function ancestors(graph, slug) {
  const out = new Set();
  const stack = [...(graph.get(slug) ?? [])];
  while (stack.length) {
    const n = stack.pop();
    if (out.has(n)) continue;
    out.add(n);
    stack.push(...(graph.get(n) ?? []));
  }
  return out;
}

/** Aristas directas course -> prerequisite que ya están implicadas por otro camino (redundancia transitiva). */
export function redundantEdges(graph) {
  const redundant = [];
  for (const [course, prereqs] of graph) {
    for (const p of prereqs) {
      const viaOthers = prereqs.filter((q) => q !== p).some((q) => ancestors(graph, q).has(p));
      if (viaOthers) redundant.push({ course, prerequisite: p });
    }
  }
  return redundant;
}

/**
 * Valida la estructura y la coherencia del catálogo.
 * @returns {{ errors: string[], warnings: string[], stats: object }}
 */
export function validateCatalog(catalog) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);

  if (!catalog || typeof catalog !== 'object') return { errors: ['El catálogo no es un objeto JSON'], warnings, stats: {} };
  if (!VERSION.test(catalog.version ?? '')) err(`version debe ser AAAA-MM-DD (valor: ${JSON.stringify(catalog.version)})`);
  if (!Array.isArray(catalog.skills)) err('skills debe ser un array');
  if (!Array.isArray(catalog.courses)) err('courses debe ser un array');
  if (errors.length) return { errors, warnings, stats: {} };

  const { skills, courses } = catalog;

  // --- skills ---
  for (const d of duplicates(skills.map((s) => s.slug))) err(`skill duplicada: ${d}`);
  for (const s of skills) {
    const id = `skill ${JSON.stringify(s.slug)}`;
    if (!SKILL_SLUG.test(s.slug ?? '')) err(`${id}: slug debe ser kebab-case en minúsculas`);
    if (!isNonEmptyString(s.name)) err(`${id}: falta name`);
    if (!AREAS.includes(s.area)) err(`${id}: area inválida ${JSON.stringify(s.area)} (válidas: ${AREAS.join('|')})`);
  }
  const skillSlugs = new Set(skills.map((s) => s.slug));

  // --- cursos: campos y enums ---
  for (const d of duplicates(courses.map((c) => c.slug))) err(`curso duplicado: ${d}`);
  const courseSlugs = new Set(courses.map((c) => c.slug));
  for (const c of courses) {
    const id = `curso ${JSON.stringify(c.slug)}`;
    if (!COURSE_SLUG.test(c.slug ?? '')) err(`${id}: slug con caracteres no válidos para URL`);
    for (const f of ['title', 'summary']) if (!isNonEmptyString(c[f])) err(`${id}: falta ${f}`);
    if (c.url !== `${COURSE_URL_PREFIX}${c.slug}`) err(`${id}: url debe ser ${COURSE_URL_PREFIX}${c.slug} (valor: ${c.url})`);
    if (!/^https:\/\//.test(c.imageUrl ?? '')) err(`${id}: imageUrl debe ser https://`);
    if (!LEVELS.includes(c.level)) err(`${id}: level inválido ${JSON.stringify(c.level)} (válidos: ${LEVELS.join('|')})`);
    if (typeof c.durationHours !== 'number' || !(c.durationHours > 0)) err(`${id}: durationHours debe ser un número > 0`);
    const list = {};
    for (const f of ['teaches', 'requires', 'prerequisites']) {
      if (!Array.isArray(c[f])) err(`${id}: ${f} debe ser un array`);
      list[f] = Array.isArray(c[f]) ? c[f] : [];
      for (const d of duplicates(list[f])) err(`${id}: ${f} repite ${d}`);
    }
    if (list.teaches.length === 0) err(`${id}: no enseña ninguna skill`);
    for (const s of [...list.teaches, ...list.requires]) if (!skillSlugs.has(s)) err(`${id}: skill inexistente ${s}`);
    for (const s of list.teaches.filter((t) => list.requires.includes(t))) warn(`${id}: enseña y requiere a la vez ${s}`);
    for (const p of list.prerequisites) {
      if (p === c.slug) err(`${id}: es prerrequisito de sí mismo`);
      else if (!courseSlugs.has(p)) err(`${id}: prerrequisito inexistente ${p}`);
    }
  }

  // --- skills sin curso que las enseñe ---
  const taught = new Set(courses.flatMap((c) => (Array.isArray(c.teaches) ? c.teaches : [])));
  for (const s of skills) if (!taught.has(s.slug)) err(`skill ${s.slug}: ningún curso la enseña`);

  // --- grafo: DAG ---
  const graph = prerequisiteGraph(catalog);
  const cycle = findCycle(graph);
  if (cycle) err(`ciclo en prerrequisitos (A => B: A requiere B): ${cycle.join(' => ')}`);

  // --- coherencia de nivel y redundancias (solo si es un DAG) ---
  const bySlug = new Map(courses.map((c) => [c.slug, c]));
  if (!cycle) {
    for (const c of courses) {
      if (c.level !== 'beginner') continue;
      for (const a of ancestors(graph, c.slug)) {
        if (bySlug.get(a)?.level === 'advanced') err(`curso ${c.slug} (beginner) requiere, directa o transitivamente, ${a} (advanced)`);
      }
    }
    for (const { course, prerequisite } of redundantEdges(graph)) {
      warn(`arista transitiva redundante: ${prerequisite} -> ${course}`);
    }
  }

  const byArea = Object.fromEntries(AREAS.map((a) => [a, skills.filter((s) => s.area === a).length]));
  const byLevel = Object.fromEntries(LEVELS.map((l) => [l, courses.filter((c) => c.level === l).length]));
  const stats = {
    courses: courses.length,
    skills: skills.length,
    skillsByArea: byArea,
    coursesByLevel: byLevel,
    prerequisiteEdges: [...graph.values()].reduce((n, ps) => n + ps.length, 0),
    rootCourses: [...graph.values()].filter((ps) => ps.length === 0).length,
  };
  return { errors, warnings, stats };
}

/**
 * Forma canónica del catálogo para un seed idempotente: arrays ordenados y sin duplicados,
 * de modo que el mismo catalog.json produzca siempre el mismo conjunto de filas y relaciones.
 */
export function normalizeCatalog(catalog) {
  const uniqSorted = (xs) => [...new Set(xs)].sort();
  return {
    version: catalog.version,
    skills: [...catalog.skills].sort((a, b) => a.slug.localeCompare(b.slug)),
    courses: [...catalog.courses]
      .map((c) => ({ ...c, teaches: uniqSorted(c.teaches), requires: uniqSorted(c.requires), prerequisites: uniqSorted(c.prerequisites) }))
      .sort((a, b) => a.slug.localeCompare(b.slug)),
  };
}

export async function loadCatalog(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

// --- CLI ---
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const path = resolve(process.argv[2] ?? join(repoRoot, 'api/src/catalog/infrastructure/seed/catalog.json'));
  let catalog;
  try {
    catalog = await loadCatalog(path);
  } catch (e) {
    console.error(`ERROR: no se pudo leer ${path}: ${e.message}`);
    process.exit(1);
  }
  const { errors, warnings, stats } = validateCatalog(catalog);
  console.log(`Catálogo: ${path}`);
  console.log(`version ${catalog.version} · ${JSON.stringify(stats)}`);
  for (const w of warnings) console.log(`WARN  ${w}`);
  for (const e of errors) console.error(`ERROR ${e}`);
  if (errors.length) {
    console.error(`\nFALLO: ${errors.length} error(es), ${warnings.length} aviso(s).`);
    process.exit(1);
  }
  console.log(`\nOK: ${warnings.length} aviso(s), 0 errores. Grafo de prerrequisitos acíclico.`);
}
