import { DomainError } from '../../shared/domain/domain-error';
import { CHALLENGES } from './challenge-bank';
import { challengeById } from './questions';
import { SKILL_LEVEL_MAX } from './skill-profile';

/** Turnos máximos de conversación (sin contar los retos) y mínimo antes de poder cerrar. */
export const MAX_RECRUITER_TURNS = 12;
export const MIN_RECRUITER_TURNS = 5;

export type RecruiterAction = 'ask' | 'challenge' | 'finish';

/** Lo que el modelo propone en cada turno. El dominio decide si es aceptable. */
export interface RecruiterDecision {
  say: string;
  action: RecruiterAction;
  challengeId?: string;
  /** Niveles deducidos de lo que dijo la persona, con la cita que los respalda. */
  levels: { skill: string; level: number; quote: string }[];
  targetSkills: string[];
}

export interface RecruiterExchange {
  /** Lo que preguntó el reclutador. */
  ask: string;
  /** Lo que respondió la persona. */
  reply: string;
}

/**
 * Decisión saneada: el reto sale del banco curado (nunca inventado), los niveles se recortan al
 * rango y se filtran contra el catálogo, y no se puede cerrar antes del mínimo de turnos.
 */
export function sanitizeDecision(
  decision: RecruiterDecision,
  ctx: {
    knownSkills: Set<string>;
    askedChallengeIds: Set<string>;
    exchanges: number;
  },
): RecruiterDecision {
  const levels = decision.levels
    .filter((l) => ctx.knownSkills.has(l.skill) && l.quote.trim().length > 0)
    .map((l) => ({
      skill: l.skill,
      level: Math.max(0, Math.min(SKILL_LEVEL_MAX, Math.round(l.level))),
      quote: l.quote.slice(0, 300),
    }));
  const targetSkills = [...new Set(decision.targetSkills)]
    .filter((s) => ctx.knownSkills.has(s))
    .slice(0, 4);

  let action = decision.action;
  let challengeId = decision.challengeId;

  if (action === 'challenge') {
    const usable =
      challengeId &&
      challengeById(challengeId) &&
      !ctx.askedChallengeIds.has(challengeId);
    if (!usable) {
      // Propuso un reto inexistente o repetido: se elige uno del banco o se sigue preguntando.
      const next = CHALLENGES.find((c) => !ctx.askedChallengeIds.has(c.id));
      if (next) challengeId = next.id;
      else action = 'ask';
    }
  }
  if (action === 'finish' && ctx.exchanges < MIN_RECRUITER_TURNS)
    action = 'ask';
  if (action !== 'challenge') challengeId = undefined;
  if (ctx.exchanges >= MAX_RECRUITER_TURNS) action = 'finish';

  // El modelo a veces deja `say` vacío al lanzar un reto: la conversación nunca se queda muda.
  const fallback =
    action === 'challenge'
      ? 'Vamos con un mini-reto rápido para verlo en código.'
      : action === 'finish'
        ? 'Con esto tengo una idea clara de dónde estás. Gracias por tu tiempo.'
        : '¿Me cuentas un poco más sobre eso?';

  return {
    say: decision.say.trim() || fallback,
    action,
    challengeId,
    levels,
    targetSkills,
  };
}

export function assertRecruiterMode(mode: string): void {
  if (mode !== 'recruiter') {
    throw new DomainError(
      'ASSESSMENT_WRONG_MODE',
      'Esta entrevista no es un simulacro: responde con el flujo guiado',
      'conflict',
    );
  }
}

export function assertGuidedMode(mode: string): void {
  if (mode !== 'guided') {
    throw new DomainError(
      'ASSESSMENT_WRONG_MODE',
      'Esta entrevista es un simulacro: responde al reclutador',
      'conflict',
    );
  }
}
