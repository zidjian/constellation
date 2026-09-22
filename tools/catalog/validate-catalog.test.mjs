// node --test tools/catalog/validate-catalog.test.mjs
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadCatalog, normalizeCatalog, validateCatalog } from './validate-catalog.mjs';

const CATALOG = join(dirname(fileURLToPath(import.meta.url)), '../../api/src/catalog/infrastructure/seed/catalog.json');

const course = (slug, extra = {}) => ({
  slug,
  title: slug,
  url: `https://cursos.devtalles.com/courses/${slug}`,
  imageUrl: 'https://import.cdn.thinkific.com/x.jpg',
  summary: 's',
  level: 'beginner',
  durationHours: 1,
  teaches: ['js'],
  requires: [],
  prerequisites: [],
  ...extra,
});
const fixture = (courses) => ({
  version: '2026-09-21',
  skills: [{ slug: 'js', name: 'JS', area: 'fundamentals' }],
  courses,
});

test('el catálogo real es válido', async () => {
  const { errors } = validateCatalog(await loadCatalog(CATALOG));
  assert.deepEqual(errors, []);
});

test('un DAG válido no produce errores', () => {
  const { errors } = validateCatalog(fixture([course('a'), course('b', { prerequisites: ['a'] })]));
  assert.deepEqual(errors, []);
});

test('detecta ciclos e imprime el recorrido', () => {
  const { errors } = validateCatalog(
    fixture([course('a', { prerequisites: ['b'] }), course('b', { prerequisites: ['a'] })]),
  );
  assert.ok(errors.some((e) => /ciclo/.test(e)), errors.join('\n'));
});

test('detecta referencias rotas a cursos y skills', () => {
  const { errors } = validateCatalog(
    fixture([course('a', { prerequisites: ['no-existe'], requires: ['skill-fantasma'] })]),
  );
  assert.ok(errors.some((e) => /no-existe/.test(e)), errors.join('\n'));
  assert.ok(errors.some((e) => /skill-fantasma/.test(e)), errors.join('\n'));
});

test('exige escapes %XX válidos en los slugs', () => {
  assert.deepEqual(validateCatalog(fixture([course('Ingenier%C3%ADa-de-prompts')])).errors, []);
  assert.ok(validateCatalog(fixture([course('Ingenier%ZZ')])).errors.length > 0);
});

test('normalizeCatalog es estable e idempotente', async () => {
  const once = normalizeCatalog(await loadCatalog(CATALOG));
  assert.deepEqual(normalizeCatalog(once), once);
});
