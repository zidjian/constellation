import { z } from 'zod';
import { COURSE_LEVELS, SKILL_AREAS, type Catalog } from '../../domain/catalog';

// Forma de catalog.json. Valida estructura; la coherencia del grafo la garantiza CatalogGraph.
const slugList = z.array(z.string().min(1)).default([]);

export const catalogFileSchema = z.object({
  version: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  skills: z.array(
    z.object({
      slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
      name: z.string().min(1),
      area: z.enum(SKILL_AREAS),
    }),
  ),
  courses: z.array(
    z.object({
      slug: z.string().regex(/^[A-Za-z0-9](?:[A-Za-z0-9_-]|%[0-9A-F]{2})*$/),
      title: z.string().min(1),
      url: z.url().startsWith('https://cursos.devtalles.com/courses/'),
      imageUrl: z.url(),
      summary: z.string(),
      level: z.enum(COURSE_LEVELS),
      durationHours: z.number().positive(),
      teaches: slugList,
      requires: slugList,
      prerequisites: slugList,
    }),
  ),
});

export type CatalogFile = z.infer<typeof catalogFileSchema>;

export function parseCatalogFile(raw: unknown): CatalogFile & Catalog {
  const parsed = catalogFileSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 10)
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`catalog.json con formato inválido:\n${issues}`);
  }
  return parsed.data;
}
