import { Inject, Injectable, Logger } from '@nestjs/common';
import { CatalogGraphProvider } from '../../catalog/application/catalog-graph.provider';
import { DomainError } from '../../shared/domain/domain-error';
import { ENV } from '../../shared/infrastructure/config/config.module';
import type { Env } from '../../shared/infrastructure/config/env';
import { AssessmentSession } from '../domain/assessment-session';
import { challengeById } from '../domain/questions';
import {
  assertRecruiterMode,
  MAX_RECRUITER_TURNS,
  type RecruiterExchange,
} from '../domain/recruiter';
import {
  ASSESSMENT_REPOSITORY,
  type AssessmentRepository,
} from '../domain/ports';
import {
  ClaudeRecruiter,
  type InterviewReport,
  type RecruiterContext,
} from '../infrastructure/claude-recruiter';
import { toView, type AssessmentView } from './assessment-view';

export interface RecruiterTurn {
  session: AssessmentView;
  /** Lo que dice el reclutador en este turno. */
  say: string;
  /** Si toca mini-reto, la pregunta pública (sin la respuesta correcta). */
  challenge: ReturnType<typeof publicChallenge> | null;
  /** true cuando el reclutador cerró: ya se puede pedir el informe y la ruta. */
  finished: boolean;
}

const publicChallenge = (id: string) => {
  const c = challengeById(id)!;
  return {
    id: c.id,
    skill: c.skill,
    difficulty: c.difficulty,
    prompt: c.prompt,
    code: c.code,
    language: c.language,
    options: c.options,
  };
};

type Answer = Record<string, unknown>;

/** Los payloads guardados son jsonb: se leen con tipo, nunca coaccionando a string. */
const textOf = (value: object): string =>
  'text' in value && typeof value.text === 'string' ? value.text : '';

@Injectable()
export class RecruiterUseCases {
  private readonly logger = new Logger(RecruiterUseCases.name);

  constructor(
    @Inject(ASSESSMENT_REPOSITORY)
    private readonly sessions: AssessmentRepository,
    private readonly recruiter: ClaudeRecruiter,
    private readonly catalog: CatalogGraphProvider,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** El simulacro depende de la IA: si está apagada, no se ofrece (la entrevista guiada sí funciona). */
  private assertEnabled(): void {
    if (!this.env.RECRUITER_ENABLED || this.env.LLM_PROVIDER !== 'claude') {
      throw new DomainError(
        'RECRUITER_DISABLED',
        'El simulacro de entrevista no está disponible ahora mismo. Usa la entrevista guiada.',
        'conflict',
      );
    }
  }

  async start(userId: string, jobOffer: string): Promise<RecruiterTurn> {
    this.assertEnabled();
    const offer = jobOffer.trim();
    if (offer.length < 10 || offer.length > 4000) {
      throw new DomainError(
        'RECRUITER_INVALID_OFFER',
        'Cuéntanos a qué puesto aspiras (o pega la oferta): entre 10 y 4000 caracteres',
        'validation',
      );
    }
    const current = await this.sessions.findInProgress(userId);
    if (current) {
      current.abandon();
      await this.sessions.save(current);
    }
    const session = AssessmentSession.start(
      this.sessions.newId(),
      userId,
      'recruiter',
    );
    session.answer('goal', { text: offer }, null);
    await this.sessions.save(session);
    return this.advance(session);
  }

  async reply(
    userId: string,
    sessionId: string,
    input: { text?: string; optionId?: string },
  ): Promise<RecruiterTurn> {
    this.assertEnabled();
    const session = await this.load(userId, sessionId);
    session.assertOpen();
    assertRecruiterMode(session.mode);

    const pending = this.pendingChallengeId(session);
    if (pending) {
      const challenge = challengeById(pending)!;
      if (
        !input.optionId ||
        !challenge.options.some((o) => o.id === input.optionId)
      ) {
        throw new DomainError(
          'ASSESSMENT_INVALID_ANSWER',
          'Elige una de las opciones del reto',
          'validation',
        );
      }
      session.answer(
        `ch:${challenge.id}`,
        { optionId: input.optionId },
        input.optionId === challenge.correctOptionId ? 1 : 0,
      );
    } else {
      const text = (input.text ?? '').trim();
      if (text.length < 2 || text.length > 4000) {
        throw new DomainError(
          'ASSESSMENT_INVALID_ANSWER',
          'Escribe tu respuesta (máximo 4000 caracteres)',
          'validation',
        );
      }
      session.answer(`rep:${this.exchanges(session).length}`, { text }, null);
    }
    return this.advance(session);
  }

  /** Pide el siguiente turno al reclutador y lo persiste. */
  private async advance(session: AssessmentSession): Promise<RecruiterTurn> {
    const ctx = await this.context(session);
    const signal = AbortSignal.timeout(this.env.LLM_RECRUITER_TIMEOUT_MS);
    let decision;
    try {
      decision = await this.recruiter.next(ctx, signal);
    } catch (err) {
      this.logger.warn(
        `Simulacro ${session.id}: ${err instanceof Error ? err.message : 'error'}`,
      );
      throw new DomainError(
        'RECRUITER_UNAVAILABLE',
        'El reclutador no responde en este momento. Prueba de nuevo o usa la entrevista guiada.',
        'conflict',
      );
    }

    const index = this.exchanges(session).length;
    if (decision.levels.length)
      session.answer(`lvl:${index}`, { deduced: decision.levels }, null);
    if (decision.targetSkills.length)
      session.answer(
        `tgt:${index}`,
        { targetSkills: decision.targetSkills },
        null,
      );

    if (decision.action === 'challenge' && decision.challengeId) {
      session.answer(
        `chq:${decision.challengeId}`,
        { text: decision.say },
        null,
      );
    } else if (decision.action === 'ask') {
      session.answer(`ask:${index}`, { text: decision.say }, null);
    } else {
      session.answer(`end:${index}`, { text: decision.say }, null);
    }
    await this.sessions.save(session);

    return {
      session: toView(session),
      say: decision.say,
      challenge: decision.challengeId
        ? publicChallenge(decision.challengeId)
        : null,
      finished: decision.action === 'finish',
    };
  }

  /** Estado de la conversación tal como lo ve el reclutador. */
  private async context(session: AssessmentSession): Promise<RecruiterContext> {
    const graph = await this.catalog.get();
    return {
      jobOffer: this.answerText(session, 'goal') ?? '',
      exchanges: this.exchanges(session),
      challengesAsked: session.answers
        .filter((a) => a.questionKey.startsWith('ch:'))
        .map((a) => {
          const c = challengeById(a.questionKey.slice(3))!;
          return {
            id: c.id,
            skill: c.skill,
            difficulty: c.difficulty,
            correct: a.score === 1,
          };
        }),
      knownSkills: graph.catalog.skills.map(({ slug, name }) => ({
        slug,
        name,
      })),
    };
  }

  /** Pares pregunta/respuesta ya cerrados. Un reto cuenta como intercambio cuando se responde. */
  private exchanges(session: AssessmentSession): RecruiterExchange[] {
    const out: RecruiterExchange[] = [];
    let pendingAsk: string | null = null;
    for (const a of session.answers) {
      const value = a.answer as Answer;
      if (a.questionKey.startsWith('ask:')) pendingAsk = textOf(value);
      else if (a.questionKey.startsWith('chq:')) pendingAsk = textOf(value);
      else if (a.questionKey.startsWith('rep:') && pendingAsk !== null) {
        out.push({ ask: pendingAsk, reply: textOf(value) });
        pendingAsk = null;
      } else if (a.questionKey.startsWith('ch:') && pendingAsk !== null) {
        out.push({ ask: pendingAsk, reply: `[respondió el mini-reto]` });
        pendingAsk = null;
      }
    }
    return out;
  }

  private pendingChallengeId(session: AssessmentSession): string | null {
    const answered = new Set(
      session.answers
        .filter((a) => a.questionKey.startsWith('ch:'))
        .map((a) => a.questionKey.slice(3)),
    );
    const asked = session.answers
      .filter((a) => a.questionKey.startsWith('chq:'))
      .map((a) => a.questionKey.slice(4))
      .filter((id) => !answered.has(id));
    return asked.at(-1) ?? null;
  }

  private answerText(session: AssessmentSession, key: string): string | null {
    const found = session.answers.find((a) => a.questionKey === key);
    return found ? textOf(found.answer) : null;
  }

  /** Niveles y objetivos deducidos por el reclutador, con el último turno mandando. */
  deduced(session: AssessmentSession): {
    levels: Record<string, number>;
    targetSkills: string[];
  } {
    const levels: Record<string, number> = {};
    let targetSkills: string[] = [];
    for (const a of session.answers) {
      const value = a.answer as Answer;
      if (a.questionKey.startsWith('lvl:')) {
        for (const l of (value.levels ?? []) as {
          skill: string;
          level: number;
        }[])
          levels[l.skill] = l.level;
      }
      if (a.questionKey.startsWith('tgt:'))
        targetSkills = (value.targetSkills ?? []) as string[];
    }
    return { levels, targetSkills };
  }

  async writeReport(
    session: AssessmentSession,
    levels: Record<string, number>,
  ): Promise<InterviewReport | null> {
    try {
      const ctx = await this.context(session);
      return await this.recruiter.report(
        ctx,
        levels,
        AbortSignal.timeout(this.env.LLM_REPORT_TIMEOUT_MS),
      );
    } catch (err) {
      // El informe es un extra: si falla, la entrevista y la ruta siguen su curso.
      this.logger.warn(
        `Informe del simulacro ${session.id} no disponible: ${err instanceof Error ? err.message : ''}`,
      );
      return null;
    }
  }

  get maxTurns(): number {
    return MAX_RECRUITER_TURNS;
  }

  private async load(userId: string, id: string): Promise<AssessmentSession> {
    const session = await this.sessions.findForUser(id, userId);
    if (!session)
      throw new DomainError(
        'ASSESSMENT_NOT_FOUND',
        'No encontramos esa entrevista',
        'not_found',
      );
    return session;
  }
}
