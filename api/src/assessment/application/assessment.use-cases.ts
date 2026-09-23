import { Inject, Injectable, Logger } from '@nestjs/common';
import { CatalogGraphProvider } from '../../catalog/application/catalog-graph.provider';
import { DomainError } from '../../shared/domain/domain-error';
import { AssessmentSession } from '../domain/assessment-session';
import { assertGuidedMode } from '../domain/recruiter';
import {
  ASSESSMENT_REPOSITORY,
  type AssessmentRepository,
  type InterpreterInput,
  SKILL_INTERPRETER,
  type SkillInterpreterPort,
} from '../domain/ports';
import {
  areaOf,
  challengeById,
  nextQuestion,
  normalizeAnswer,
  scoreAnswer,
  stackOf,
  validateAnswer,
} from '../domain/questions';
import type { SkillProfile } from '../domain/skill-profile';
import {
  toView,
  type AssessmentView,
  type PublicQuestion,
} from './assessment-view';

const notFound = () =>
  new DomainError(
    'ASSESSMENT_NOT_FOUND',
    'No encontramos esa entrevista',
    'not_found',
  );

import { RecruiterUseCases } from './recruiter.use-cases';

@Injectable()
export class AssessmentUseCases {
  private readonly logger = new Logger(AssessmentUseCases.name);

  constructor(
    @Inject(ASSESSMENT_REPOSITORY)
    private readonly sessions: AssessmentRepository,
    @Inject(SKILL_INTERPRETER)
    private readonly interpreter: SkillInterpreterPort,
    private readonly catalog: CatalogGraphProvider,
    private readonly recruiter: RecruiterUseCases,
  ) {}

  /** Inicia una entrevista. Si había otra en curso, se abandona (máximo una in_progress). */
  async start(
    userId: string,
  ): Promise<{ session: AssessmentView; question: PublicQuestion }> {
    const current = await this.sessions.findInProgress(userId);
    if (current) {
      current.abandon();
      await this.sessions.save(current);
    }
    const session = AssessmentSession.start(this.sessions.newId(), userId);
    await this.sessions.save(session);
    const question = nextQuestion([], { graph: await this.catalog.get() })!;
    return { session: toView(session), question };
  }

  /** Entrevista en curso del usuario (para retomarla), o null. */
  async current(userId: string): Promise<{
    session: AssessmentView;
    question: PublicQuestion | null;
  } | null> {
    const session = await this.sessions.findInProgress(userId);
    if (!session) return null;
    const question = nextQuestion([...session.answers], {
      graph: await this.catalog.get(),
    });
    return { session: toView(session), question };
  }

  async answer(
    userId: string,
    sessionId: string,
    questionKey: string,
    rawAnswer: unknown,
  ): Promise<{
    session: AssessmentView;
    result: { correct: boolean } | null;
    next: PublicQuestion | null;
  }> {
    const session = await this.sessions.findForUser(sessionId, userId);
    if (!session) throw notFound();
    session.assertOpen();
    assertGuidedMode(session.mode);

    const ctx = { graph: await this.catalog.get() };
    const expected = nextQuestion([...session.answers], ctx);
    if (!expected) {
      throw new DomainError(
        'ASSESSMENT_NO_MORE_QUESTIONS',
        'No quedan preguntas: termina la entrevista',
        'conflict',
      );
    }
    if (expected.key !== questionKey) {
      throw new DomainError(
        'ASSESSMENT_UNEXPECTED_QUESTION',
        `Se esperaba la pregunta ${expected.key}`,
        'conflict',
      );
    }
    const invalid = validateAnswer(expected, rawAnswer);
    if (invalid)
      throw new DomainError('ASSESSMENT_INVALID_ANSWER', invalid, 'validation');

    const answer = normalizeAnswer(
      expected,
      rawAnswer as Record<string, unknown>,
    );
    const score = scoreAnswer(expected, answer);
    session.answer(questionKey, answer, score);
    await this.sessions.save(session);

    return {
      session: toView(session),
      result: score === null ? null : { correct: score === 1 },
      next: nextQuestion([...session.answers], ctx),
    };
  }

  async complete(
    userId: string,
    sessionId: string,
  ): Promise<{
    session: AssessmentView;
    profile: SkillProfile;
    report?: unknown;
  }> {
    const session = await this.sessions.findForUser(sessionId, userId);
    if (!session) throw notFound();
    session.complete(new Date()); // valida estado y mínimo de respuestas antes de interpretar

    const graph = await this.catalog.get();
    const input =
      session.mode === 'recruiter'
        ? this.recruiterInput(session, graph.catalog.skills)
        : this.interpreterInput(session, graph.catalog.skills);
    const { profile, by } = await this.interpreter.interpret(input);

    // El informe es del simulacro y puede faltar: la entrevista se cierra igual.
    const report =
      session.mode === 'recruiter'
        ? await this.recruiter.writeReport(session, profile.levels)
        : null;

    await this.sessions.save(session, { profile, interpretedBy: by });
    if (report) await this.sessions.saveReport(session.id, report);
    this.logger.log(
      `Entrevista ${session.id} (${session.mode}) completada (${by}): ${profile.targetSkills.join(', ')}`,
    );
    return { session: toView(session), profile, report: report ?? undefined };
  }

  async report(userId: string, sessionId: string): Promise<unknown> {
    const session = await this.sessions.findForUser(sessionId, userId);
    if (!session) throw notFound();
    const stored = await this.sessions.findReport(session.id);
    if (stored) return stored;
    // Si el informe falló al completar (timeout del LLM), se reintenta aquí en vez de perderse.
    if (session.mode !== 'recruiter' || session.status !== 'completed')
      return null;
    const saved = await this.sessions.findProfile(session.id);
    if (!saved) return null;
    const report = await this.recruiter.writeReport(
      session,
      saved.profile.levels,
    );
    if (report) await this.sessions.saveReport(session.id, report);
    return report;
  }

  /** En el simulacro, los niveles y objetivos los dedujo el reclutador turno a turno. */
  private recruiterInput(
    session: AssessmentSession,
    knownSkills: { slug: string; name: string }[],
  ): InterpreterInput {
    const { levels, targetSkills } = this.recruiter.deduced(session);
    const goal = session.answers.find((a) => a.questionKey === 'goal')?.answer;
    return {
      goal: goal && 'text' in goal ? goal.text : '',
      area: null,
      stackTargets: targetSkills,
      selfLevels: levels,
      challenges: session.answers
        .filter((a) => a.questionKey.startsWith('ch:') && a.score !== null)
        .map((a) => {
          const ch = challengeById(a.questionKey.slice(3))!;
          return {
            skill: ch.skill,
            difficulty: ch.difficulty,
            correct: a.score === 1,
          };
        }),
      knownSkills: knownSkills.map(({ slug, name }) => ({ slug, name })),
    };
  }

  private interpreterInput(
    session: AssessmentSession,
    knownSkills: { slug: string; name: string }[],
  ): InterpreterInput {
    const answers = [...session.answers];
    const goal = answers.find((a) => a.questionKey === 'goal')?.answer;
    const self = answers.find((a) => a.questionKey === 'self')?.answer;
    return {
      goal: goal && 'text' in goal ? goal.text : '',
      area: areaOf(answers)?.id ?? null,
      stackTargets: stackOf(answers)?.targets ?? [],
      selfLevels: self && 'levels' in self ? self.levels : {},
      challenges: answers
        .filter((a) => a.questionKey.startsWith('ch:') && a.score !== null)
        .map((a) => {
          const ch = challengeById(a.questionKey.slice(3))!;
          return {
            skill: ch.skill,
            difficulty: ch.difficulty,
            correct: a.score === 1,
          };
        }),
      knownSkills: knownSkills.map(({ slug, name }) => ({ slug, name })),
    };
  }
}
