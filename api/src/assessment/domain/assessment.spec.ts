import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Catalog } from '../../catalog/domain/catalog';
import { CatalogGraph } from '../../catalog/domain/catalog-graph';
import { RulesSkillInterpreter } from '../infrastructure/rules-skill-interpreter';
import { AssessmentSession } from './assessment-session';
import { CHALLENGES } from './challenge-bank';
import {
  MAX_QUESTIONS,
  nextQuestion,
  normalizeAnswer,
  type Question,
  type RecordedAnswer,
  scoreAnswer,
  selfAssessmentItems,
  validateAnswer,
} from './questions';

const catalog = JSON.parse(
  readFileSync(
    join(__dirname, '../../catalog/infrastructure/seed/catalog.json'),
    'utf8',
  ),
) as Catalog;
const ctx = { graph: CatalogGraph.from(catalog) };

const correctOf = (key: string) =>
  CHALLENGES.find((c) => `ch:${c.id}` === key)!.correctOptionId;
const wrongOf = (key: string) =>
  CHALLENGES.find((c) => `ch:${c.id}` === key)!.options.find(
    (o) => o.id !== correctOf(key),
  )!.id;

/** Simula una entrevista: `pick` decide la respuesta de cada pregunta. */
function run(pick: (q: Question) => Record<string, unknown>): RecordedAnswer[] {
  const answers: RecordedAnswer[] = [];
  for (let q = nextQuestion(answers, ctx); q; q = nextQuestion(answers, ctx)) {
    const raw = pick(q);
    expect(validateAnswer(q, raw)).toBeNull();
    const answer = normalizeAnswer(q, raw);
    answers.push({ questionKey: q.key, answer, score: scoreAnswer(q, answer) });
  }
  return answers;
}
const backendNode =
  (challenge: (key: string) => string, self = 1) =>
  (q: Question) => {
    if (q.type === 'text')
      return { text: 'Quiero trabajar de backend con Node y Docker' };
    if (q.key === 'area') return { optionId: 'backend' };
    if (q.key === 'stack') return { optionId: 'node' };
    if (q.type === 'scale')
      return {
        levels: Object.fromEntries(q.items.map((i) => [i.skill, self])),
      };
    return { optionId: challenge(q.key) };
  };

describe('AssessmentSession (máquina de estados)', () => {
  const withAnswers = (n: number) => {
    const s = AssessmentSession.start('s1', 'u1');
    for (let i = 0; i < n; i++) s.answer(`q${i}`, { text: 'x' }, null);
    return s;
  };

  it('no se puede completar con menos de 5 respuestas', () => {
    expect(() => withAnswers(4).complete(new Date())).toThrow(
      expect.objectContaining({ code: 'ASSESSMENT_TOO_SHORT' }) as Error,
    );
  });

  it('completada es inmutable: no admite respuestas, ni completar ni abandonar otra vez', () => {
    const s = withAnswers(5);
    s.complete(new Date());
    expect(s.status).toBe('completed');
    const already = expect.objectContaining({
      code: 'ASSESSMENT_ALREADY_COMPLETED',
    }) as Error;
    expect(() => s.answer('otra', { text: 'x' }, null)).toThrow(already);
    expect(() => s.complete(new Date())).toThrow(already);
    expect(() => s.abandon()).toThrow(already);
  });

  it('abandonada no admite más cambios', () => {
    const s = withAnswers(1);
    s.abandon();
    expect(() => s.answer('q9', { text: 'x' }, null)).toThrow(
      expect.objectContaining({ code: 'ASSESSMENT_ABANDONED' }) as Error,
    );
  });

  it('rechaza respuestas repetidas y más de 10', () => {
    const s = withAnswers(1);
    expect(() => s.answer('q0', { text: 'x' }, null)).toThrow(
      expect.objectContaining({ code: 'ASSESSMENT_ALREADY_ANSWERED' }) as Error,
    );
    const full = withAnswers(MAX_QUESTIONS);
    expect(() => full.answer('extra', { text: 'x' }, null)).toThrow(
      expect.objectContaining({ code: 'ASSESSMENT_FULL' }) as Error,
    );
  });
});

describe('Flujo adaptativo', () => {
  it('sigue el orden objetivo → área → stack → autoevaluación → retos', () => {
    const keys = run(backendNode(correctOf)).map((a) => a.questionKey);
    expect(keys.slice(0, 4)).toEqual(['goal', 'area', 'stack', 'self']);
    expect(keys.slice(4).every((k) => k.startsWith('ch:'))).toBe(true);
    expect(keys.length).toBeLessThanOrEqual(MAX_QUESTIONS);
  });

  it('la autoevaluación sale del catálogo: para NestJS pregunta por la base del stack', () => {
    const answers = run(backendNode(correctOf)).slice(0, 3);
    const skills = selfAssessmentItems(answers, ctx).map((i) => i.skill);
    expect(skills).toEqual(
      expect.arrayContaining([
        'programming-basics',
        'javascript',
        'typescript',
      ]),
    );
    expect(skills.length).toBeLessThanOrEqual(6);
  });

  it('escalera: si acierta sube de dificultad; como máximo 2 retos por skill', () => {
    const challenges = run(backendNode(correctOf)).filter((a) =>
      a.questionKey.startsWith('ch:'),
    );
    const js = challenges
      .filter((a) => a.questionKey.startsWith('ch:js-'))
      .map((a) => a.questionKey);
    expect(js).toEqual(['ch:js-1', 'ch:js-2']);
  });

  it('escalera: si falla, esa skill se da por medida y pasa a la siguiente', () => {
    const challenges = run(backendNode(wrongOf)).filter((a) =>
      a.questionKey.startsWith('ch:'),
    );
    const perSkill = new Map<string, number>();
    for (const a of challenges) {
      const skill = CHALLENGES.find(
        (c) => `ch:${c.id}` === a.questionKey,
      )!.skill;
      perSkill.set(skill, (perSkill.get(skill) ?? 0) + 1);
    }
    expect([...perSkill.values()].every((n) => n === 1)).toBe(true);
  });

  it('empieza el reto en la dificultad autoevaluada', () => {
    const challenges = run(backendNode(correctOf, 3)).filter((a) =>
      a.questionKey.startsWith('ch:js-'),
    );
    expect(challenges[0].questionKey).toBe('ch:js-3');
  });

  it('todas las áreas y stacks llegan al mínimo para completar', () => {
    const areas = nextQuestion(
      [{ questionKey: 'goal', answer: { text: 'x' }, score: null }],
      ctx,
    );
    for (const area of (areas as Extract<Question, { key: 'area' }>).options) {
      const base: RecordedAnswer[] = [
        { questionKey: 'goal', answer: { text: 'aprender' }, score: null },
        { questionKey: 'area', answer: { optionId: area.id }, score: null },
      ];
      const stacks = nextQuestion(base, ctx) as Extract<
        Question,
        { key: 'stack' }
      >;
      for (const stack of stacks.options) {
        const answers = [
          ...base,
          { questionKey: 'stack', answer: { optionId: stack.id }, score: null },
        ];
        const all = [...answers];
        for (let q = nextQuestion(all, ctx); q; q = nextQuestion(all, ctx)) {
          const raw =
            q.type === 'scale'
              ? { levels: Object.fromEntries(q.items.map((i) => [i.skill, 0])) }
              : { optionId: 'a' };
          const answer = normalizeAnswer(q, raw);
          all.push({
            questionKey: q.key,
            answer,
            score: scoreAnswer(q, answer),
          });
        }
        expect({
          stack: `${area.id}/${stack.id}`,
          ok: all.length >= 5,
        }).toEqual({
          stack: `${area.id}/${stack.id}`,
          ok: true,
        });
      }
    }
  });

  it('la pregunta pública nunca expone la respuesta correcta', () => {
    const answers = run(backendNode(correctOf)).slice(0, 4);
    const q = nextQuestion(answers, ctx)!;
    expect(q.type).toBe('challenge');
    expect(JSON.stringify(q)).not.toMatch(/correct/i);
  });

  it('valida la forma de cada tipo de respuesta', () => {
    const goal = nextQuestion([], ctx)!;
    expect(validateAnswer(goal, { text: 'no' })).toMatch(/mínimo/);
    expect(validateAnswer(goal, 'texto suelto')).toMatch(/objeto/);
    const area = nextQuestion(
      [{ questionKey: 'goal', answer: { text: 'abc' }, score: null }],
      ctx,
    )!;
    expect(validateAnswer(area, { optionId: 'marte' })).toMatch(/no válida/);
  });
});

describe('RulesSkillInterpreter', () => {
  const interpreter = new RulesSkillInterpreter();
  const knownSkills = catalog.skills.map(({ slug, name }) => ({ slug, name }));
  const base = {
    goal: '',
    area: 'backend',
    stackTargets: ['nestjs'],
    selfLevels: {},
    challenges: [],
    knownSkills,
  };

  it('los retos pesan más que la autoevaluación', async () => {
    const p = await interpreter.interpret({
      ...base,
      selfLevels: { javascript: 3, typescript: 0 },
      challenges: [
        { skill: 'javascript', difficulty: 1, correct: true },
        { skill: 'javascript', difficulty: 2, correct: false },
        { skill: 'typescript', difficulty: 1, correct: true },
        { skill: 'typescript', difficulty: 2, correct: true },
      ],
    });
    expect(p.levels.javascript).toBe(1); // dijo 3, falló el nivel 2
    expect(p.levels.typescript).toBe(2); // dijo 0, aprobó el nivel 2
  });

  it('objetivos: primero el stack, luego lo que menciona el texto (con alias)', async () => {
    const p = await interpreter.interpret({
      ...base,
      goal: 'Busco puesto con Docker, PostgreSQL y microservicios. Bonus: k8s',
    });
    expect(p.targetSkills).toEqual([
      'nestjs',
      'docker',
      'sql',
      'microservices',
    ]);
  });

  it('descarta skills desconocidas y recorta niveles al rango 0..3', async () => {
    const p = await interpreter.interpret({
      ...base,
      stackTargets: ['nestjs', 'cobol'],
      selfLevels: { javascript: 7, inventada: 2 },
    });
    expect(p.targetSkills).toEqual(['nestjs']);
    expect(p.levels).toEqual({ javascript: 3 });
  });

  it('no confunde palabras parciales ("gol" no es go, "reactivo" no es react)', async () => {
    const p = await interpreter.interpret({
      ...base,
      stackTargets: [],
      goal: 'Me gusta el fútbol, metí un gol; soy muy reactivo',
    });
    expect(p.targetSkills).toEqual([]);
  });
});
