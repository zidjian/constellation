import type { Course } from '../../catalog/domain/catalog';
import { RulesRationaleWriter } from '../infrastructure/rules-rationale-writer';
import { LearningPath } from './learning-path';

const make = (n = 3) =>
  LearningPath.create({
    id: 'p1',
    userId: 'u1',
    sessionId: 's1',
    name: '  Mi ruta backend  ',
    goal: 'backend',
    generatedBy: 'rules',
    steps: Array.from({ length: n }, (_, i) => ({
      id: `st${i}`,
      courseSlug: `c${i}`,
      position: i,
      rationale: '',
    })),
    now: new Date('2026-09-22T00:00:00Z'),
  });

describe('LearningPath', () => {
  it('nace activa, sin progreso y con el nombre recortado', () => {
    const p = make();
    expect(p.status).toBe('active');
    expect(p.name).toBe('Mi ruta backend');
    expect(p.progress).toEqual({ completed: 0, total: 3 });
  });

  it('el progreso se deriva de los pasos completados', () => {
    const p = make();
    p.completeStep('st0', new Date());
    p.completeStep('st2', new Date());
    expect(p.progress).toEqual({ completed: 2, total: 3 });
    p.uncompleteStep('st0');
    expect(p.progress).toEqual({ completed: 1, total: 3 });
  });

  it('completar dos veces es idempotente y conserva la fecha original', () => {
    const p = make();
    const first = new Date('2026-09-22T10:00:00Z');
    p.completeStep('st1', first);
    expect(
      p.completeStep('st1', new Date('2026-09-23T10:00:00Z')).completedAt,
    ).toEqual(first);
  });

  it('un paso que no es de la ruta es PATH_STEP_NOT_FOUND', () => {
    expect(() => make().completeStep('otro', new Date())).toThrow(
      expect.objectContaining({ code: 'PATH_STEP_NOT_FOUND' }) as Error,
    );
  });

  it('valida el nombre y exige al menos un paso', () => {
    expect(() => make().rename('   ')).toThrow(
      expect.objectContaining({ code: 'PATH_INVALID_NAME' }) as Error,
    );
    expect(() => make().rename('x'.repeat(81))).toThrow(
      expect.objectContaining({ code: 'PATH_INVALID_NAME' }) as Error,
    );
    expect(() => make(0)).toThrow(
      expect.objectContaining({ code: 'PATH_EMPTY' }) as Error,
    );
  });

  it('archivar y reactivar', () => {
    const p = make();
    p.setStatus('archived');
    expect(p.status).toBe('archived');
    p.setStatus('active');
    expect(p.status).toBe('active');
  });
});

describe('RulesRationaleWriter', () => {
  const course = (slug: string, extra: Partial<Course> = {}): Course => ({
    slug,
    title: slug.toUpperCase(),
    url: '',
    imageUrl: '',
    summary: '',
    level: 'beginner',
    durationHours: 10,
    teaches: [slug],
    requires: [],
    prerequisites: [],
    ...extra,
  });

  it('explica objetivo, base y nociones previas en español', () => {
    const texts = new RulesRationaleWriter().texts({
      profile: { levels: { js: 1 }, targetSkills: ['nest'] },
      skillNames: { js: 'JavaScript', nest: 'NestJS' },
      steps: [
        {
          position: 0,
          course: course('js'),
          reason: { kind: 'prerequisite', for: ['nest'] },
          dependents: [course('nest')],
        },
        {
          position: 1,
          course: course('nest', {
            level: 'intermediate',
            durationHours: 24.5,
          }),
          reason: { kind: 'target', skills: ['nest'] },
          dependents: [],
        },
      ],
    });
    expect(texts[0]).toBe(
      'Es la base de «NEST». Aquí aprendes JavaScript. Ya tienes nociones de JavaScript; este curso las consolida. Son unas 10 h de nivel inicial.',
    );
    expect(texts[1]).toBe(
      'Va directo a tu objetivo. Aquí aprendes NestJS. Son unas 24.5 h de nivel intermedio.',
    );
  });
});
