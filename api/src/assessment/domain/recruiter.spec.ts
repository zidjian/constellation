import { CHALLENGES } from './challenge-bank';
import {
  assertGuidedMode,
  assertRecruiterMode,
  MAX_RECRUITER_TURNS,
  type RecruiterDecision,
  sanitizeDecision,
} from './recruiter';

const ctx = (over: Partial<Parameters<typeof sanitizeDecision>[1]> = {}) => ({
  knownSkills: new Set(['nestjs', 'docker']),
  askedChallengeIds: new Set<string>(),
  exchanges: 6,
  ...over,
});

const decision = (
  over: Partial<RecruiterDecision> = {},
): RecruiterDecision => ({
  say: 'Contame sobre tu último proyecto.',
  action: 'ask',
  levels: [],
  targetSkills: [],
  ...over,
});

describe('sanitizeDecision', () => {
  it('descarta niveles de skills que no existen y los que no traen cita', () => {
    const out = sanitizeDecision(
      decision({
        levels: [
          { skill: 'nestjs', level: 2, quote: 'usé Nest un año' },
          { skill: 'inventada', level: 3, quote: 'algo' },
          { skill: 'docker', level: 1, quote: '   ' },
        ],
      }),
      ctx(),
    );
    expect(out.levels).toEqual([
      { skill: 'nestjs', level: 2, quote: 'usé Nest un año' },
    ]);
  });

  it('recorta el nivel al rango válido y redondea', () => {
    const out = sanitizeDecision(
      decision({
        levels: [
          { skill: 'nestjs', level: 9, quote: 'x' },
          { skill: 'docker', level: -2, quote: 'y' },
        ],
      }),
      ctx(),
    );
    expect(out.levels.map((l) => l.level)).toEqual([3, 0]);
  });

  it('filtra los objetivos contra el catálogo y los deduplica', () => {
    const out = sanitizeDecision(
      decision({ targetSkills: ['nestjs', 'nestjs', 'no-existe'] }),
      ctx(),
    );
    expect(out.targetSkills).toEqual(['nestjs']);
  });

  it('sustituye un reto inventado por uno real del banco', () => {
    const out = sanitizeDecision(
      decision({ action: 'challenge', challengeId: 'reto-que-no-existe' }),
      ctx(),
    );
    expect(out.action).toBe('challenge');
    expect(CHALLENGES.some((c) => c.id === out.challengeId)).toBe(true);
  });

  it('al sustituir el reto prefiere la skill de la que se venía hablando', () => {
    const skill = CHALLENGES.find(
      (c) => c.skill !== CHALLENGES[0].skill,
    )!.skill;
    const out = sanitizeDecision(
      decision({
        action: 'challenge',
        challengeId: 'inventado',
        targetSkills: [skill],
      }),
      ctx({ knownSkills: new Set([skill]) }),
    );
    expect(CHALLENGES.find((c) => c.id === out.challengeId)!.skill).toBe(skill);
  });

  it('si ya se preguntaron todos los retos, sigue preguntando', () => {
    const out = sanitizeDecision(
      decision({ action: 'challenge', challengeId: 'inventado' }),
      ctx({ askedChallengeIds: new Set(CHALLENGES.map((c) => c.id)) }),
    );
    expect(out.action).toBe('ask');
    expect(out.challengeId).toBeUndefined();
  });

  it('no deja cerrar antes del mínimo de intercambios', () => {
    const out = sanitizeDecision(
      decision({ action: 'finish' }),
      ctx({ exchanges: 2 }),
    );
    expect(out.action).toBe('ask');
  });

  it('cierra por obligación al llegar al máximo de turnos', () => {
    const out = sanitizeDecision(
      decision({ action: 'ask' }),
      ctx({ exchanges: MAX_RECRUITER_TURNS }),
    );
    expect(out.action).toBe('finish');
  });

  it('pone una frase por defecto si el modelo no dice nada', () => {
    const reto = sanitizeDecision(
      decision({ say: '  ', action: 'challenge', challengeId: undefined }),
      ctx(),
    );
    expect(reto.say).toMatch(/mini-reto/i);

    const cierre = sanitizeDecision(
      decision({ say: '', action: 'finish' }),
      ctx(),
    );
    expect(cierre.say.length).toBeGreaterThan(10);

    const pregunta = sanitizeDecision(decision({ say: '' }), ctx());
    expect(pregunta.say).toMatch(/\?/);
  });
});

describe('modo de la entrevista', () => {
  it('rechaza responder al reclutador en una entrevista guiada', () => {
    expect(() => assertRecruiterMode('guided')).toThrow(/no es un simulacro/i);
    expect(() => assertRecruiterMode('recruiter')).not.toThrow();
  });

  it('rechaza responder preguntas guiadas en un simulacro', () => {
    expect(() => assertGuidedMode('recruiter')).toThrow(/es un simulacro/i);
    expect(() => assertGuidedMode('guided')).not.toThrow();
  });
});
