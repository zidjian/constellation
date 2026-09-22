#!/usr/bin/env node
// Extrae el catálogo público de cursos.devtalles.com (Thinkific) a catalog.raw.json.
// Uso único/offline (ADR-0004): la app nunca consulta devtalles.com en ejecución.
// Sin dependencias: Node >= 20 (fetch nativo).
//
//   node tools/catalog/extract-devtalles.mjs [--limit N] [--delay MS]

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://cursos.devtalles.com';
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'catalog.raw.json');
const USER_AGENT = 'DevTallesConstellation-CatalogExtractor/0.1 (Code Quest 2026 hackathon)';

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const LIMIT = argValue('--limit', Infinity);
const DELAY_MS = argValue('--delay', 1000);

// Páginas de listado que aportan contexto al curador.
const ROUTE_PAGE = /\/pages\/(ruta-|programas-)/;
const CATEGORY_PAGES = {
  'todos-los-cursos': 'all',
  'todos-los-cursos-gratuitos': 'free',
  'todos-los-cursos-legacy': 'legacy',
  'todos-los-cursos-minicursos': 'mini',
  'todos-los-cursos-exclusivos': 'exclusive',
  'todos-los-cursos-en-construccion': 'in-construction',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' });
    return { status: res.status, url: res.url, body: res.ok ? await res.text() : '' };
  } catch (err) {
    if (attempt >= 3) return { status: 0, url, body: '', error: String(err) };
    await sleep(2000 * attempt);
    return get(url, attempt + 1);
  }
}

// --- helpers de HTML (regex: el markup de Thinkific es estable y esto es un script de un solo uso) ---

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
const clean = (s) => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const stripScripts = (html) => html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
const meta = (html, key) =>
  html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`))?.[1];
const courseSlug = (href) => href.match(/\/courses\/([^/"?#]+)/)?.[1];

function specBlock(html, title) {
  const i = html.indexOf(title);
  if (i < 0) return null;
  const start = html.indexOf('spec-inner-text', i);
  if (start < 0) return null;
  const open = html.indexOf('>', start) + 1;
  // El bloque termina donde empieza la siguiente columna o el botón "Mostrar más".
  const ends = ['spec-column-title', 'toggleSpecsBtn']
    .map((marker) => html.indexOf(marker, open))
    .filter((n) => n > 0)
    .map((n) => html.lastIndexOf('<', n));
  return html.slice(open, ends.length ? Math.min(...ends) : open + 20000);
}

function parseCourse(rawHtml, finalUrl) {
  const html = stripScripts(rawHtml);
  const details = [...html.matchAll(/course-curriculum-card__details-item">\s*<i class="([^"]*)"><\/i>\s*<span>([\s\S]*?)<\/span>/g)]
    .map(([, icon, text]) => ({ icon, text: clean(text) }))
    .filter((d) => d.text);
  const detail = (icon) => details.find((d) => d.icon.includes(icon))?.text ?? null;

  const lessonsText = detail('fa-file-lines');
  const hoursText = detail('fa-circle-play');

  const requirementsHtml = specBlock(html, 'Requisitos previos');
  const requirements = requirementsHtml
    ? clean(requirementsHtml.replace(/<br\s*\/?>|<\/li>|<\/p>/gi, '\n').replace(/<[^>]+>/g, ''))
        .split(/\s*•\s*/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const descriptionHtml = specBlock(html, 'Descripción del curso');
  const chapters = [...html.matchAll(/<h3 class="course-curriculum__chapter-title">([\s\S]*?)<i /g)].map(([, t]) => clean(t));

  return {
    slug: courseSlug(finalUrl),
    url: meta(html, 'og:url') ?? finalUrl,
    title: decode(meta(html, 'og:title') ?? ''),
    summary: decode(meta(html, 'description') ?? meta(html, 'og:description') ?? ''),
    imageUrl: meta(html, 'og:image') ?? null,
    price: detail('fa-tag'),
    lessons: lessonsText ? Number(lessonsText.match(/\d+/)?.[0]) : null,
    durationHours: hoursText ? Number(hoursText.match(/[\d.]+/)?.[0]) : null,
    instructor: detail('fa-graduation-cap'),
    requirements,
    description: descriptionHtml ? clean(descriptionHtml) : '',
    chapters,
  };
}

// Listados de categoría: slugs enlazados en orden de documento, sin duplicados.
function parseCategoryPage(html) {
  const slugs = [...stripScripts(html).matchAll(/href="([^"]*\/courses\/[^"]*)"/g)].map(([, href]) => courseSlug(href));
  return [...new Set(slugs.filter(Boolean))];
}

// Rutas oficiales (/pages/ruta-*, /pages/programas-*). Cada ruta ("titulo") es una rejilla de 3 columnas
// cuyas cajas tienen id le* (REQUERIDO), mi* (RECOMENDADO) o ri* (OPCIONAL) y una etiqueta de área.
// Las flechas se dibujan con `new LeaderLine({ start: <id>, end: <id> })`: start se estudia antes que end.
const TIERS = { le: 'required', mi: 'recommended', ri: 'optional' };

function parseRoutePage(rawHtml) {
  const html = stripScripts(rawHtml);
  const tracks = [];
  const firstBoxById = new Map(); // getElementById devuelve el primer elemento con ese id
  const token =
    /class="titulo">([^<]*)<|href="([^"]*\/courses\/[^"]*)"[^>]*>\s*<div class="main-box"\s*id="([^"]*)"([\s\S]*?)<\/a>/g;
  for (const [, title, href, boxId, inner] of html.matchAll(token)) {
    if (title !== undefined) {
      tracks.push({ title: clean(title), courses: [] });
      continue;
    }
    if (!tracks.length) tracks.push({ title: null, courses: [] });
    const box = {
      slug: courseSlug(href),
      boxId,
      tier: TIERS[boxId.slice(0, 2)] ?? null,
      tag: inner.match(/class="(\w+)-box">\s*<span/)?.[1] ?? null,
      label: clean(inner.match(/class="main-text"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ''),
    };
    tracks.at(-1).courses.push(box);
    if (!firstBoxById.has(boxId)) firstBoxById.set(boxId, box);
  }

  const edges = [];
  const unresolvedEdges = [];
  for (const [, from, to] of rawHtml.matchAll(/new LeaderLine\(\{\s*start:\s*(\w+),\s*end:\s*(\w+)/g)) {
    const a = firstBoxById.get(from);
    const b = firstBoxById.get(to);
    if (a && b) edges.push({ from: a.slug, to: b.slug, fromBox: from, toBox: to });
    else unresolvedEdges.push({ fromBox: from, toBox: to });
  }

  // Cursos enlazados fuera de la rejilla (o páginas sin rejilla), en orden.
  const inGrid = new Set(tracks.flatMap((t) => t.courses.map((c) => c.slug)));
  const linkedCourses = parseCategoryPage(rawHtml).filter((slug) => !inGrid.has(slug));
  return { tracks, edges, unresolvedEdges, linkedCourses };
}

async function main() {
  const sitemap = await get(`${BASE}/sitemap.xml`);
  if (!sitemap.body) throw new Error(`No se pudo leer el sitemap (HTTP ${sitemap.status})`);
  const locs = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  const courseUrls = new Set(locs.filter((u) => /\/courses\/[^/]+$/.test(u)));
  const routeUrls = locs.filter((u) => ROUTE_PAGE.test(u));
  const categoryUrls = Object.keys(CATEGORY_PAGES).map((p) => `${BASE}/pages/${p}`);

  // 1. Páginas de listado: rutas oficiales y categorías.
  const routes = [];
  const categories = {};
  for (const url of [...routeUrls, ...categoryUrls]) {
    const res = await get(url);
    await sleep(DELAY_MS);
    if (!res.body) {
      console.warn(`! ${res.status} ${url}`);
      continue;
    }
    const page = url.split('/pages/')[1];
    let found;
    if (CATEGORY_PAGES[page]) {
      found = categories[CATEGORY_PAGES[page]] = parseCategoryPage(res.body);
    } else {
      const route = parseRoutePage(res.body);
      found = [...route.tracks.flatMap((t) => t.courses.map((c) => c.slug)), ...route.linkedCourses];
      routes.push({ page, url, title: clean(pageTitle(res.body, 'og:title')), ...route });
    }
    for (const slug of found) courseUrls.add(`${BASE}/courses/${slug}`);
    console.log(`✓ página ${page} (${new Set(found).size} cursos)`);
  }

  // 2. Cursos (sitemap ∪ enlazados desde listados).
  const courses = new Map();
  const failures = [];
  for (const url of [...courseUrls].slice(0, LIMIT)) {
    const res = await get(url);
    await sleep(DELAY_MS);
    if (!res.body || !res.url.includes('/courses/')) {
      failures.push({ url, status: res.status, finalUrl: res.url, error: res.error });
      console.warn(`! ${res.status} ${url} → ${res.url}`);
      continue;
    }
    const course = parseCourse(res.body, res.url);
    const aliases = courseSlug(url) !== course.slug ? [courseSlug(url)] : [];
    const existing = courses.get(course.slug);
    if (existing) {
      existing.aliases = [...new Set([...existing.aliases, ...aliases])];
      continue;
    }
    course.aliases = aliases;
    course.categories = Object.entries(categories)
      .filter(([, slugs]) => slugs.includes(course.slug) || aliases.some((a) => slugs.includes(a)))
      .map(([name]) => name);
    courses.set(course.slug, course);
    console.log(`✓ ${course.slug} — ${course.title} (${course.durationHours ?? '?'} h)`);
  }

  const output = {
    source: BASE,
    extractedAt: new Date().toISOString(),
    note: 'Snapshot factual del sitio público. No editar a mano: se regenera con el script. La curación (nivel, skills, prerrequisitos) va en catalog.json.',
    counts: { courses: courses.size, routes: routes.length, failures: failures.length },
    courses: [...courses.values()].sort((a, b) => a.slug.localeCompare(b.slug)),
    routes: routes.sort((a, b) => a.page.localeCompare(b.page)),
    categories,
    failures,
  };
  await writeFile(OUT, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`\n${courses.size} cursos, ${routes.length} rutas oficiales, ${failures.length} fallos → ${OUT}`);
}

function pageTitle(html, key) {
  return meta(html, key) ?? html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
