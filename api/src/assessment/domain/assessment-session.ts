import { DomainError } from '../../shared/domain/domain-error';
import {
  type Answer,
  MAX_QUESTIONS,
  MIN_ANSWERS_TO_COMPLETE,
  type RecordedAnswer,
} from './questions';

export type AssessmentStatus = 'in_progress' | 'completed' | 'abandoned';

/**
 * Agregado de la entrevista. Máquina de estados irreversible:
 *   in_progress ──complete()──► completed
 *        └────────abandon()───► abandoned
 * Una evaluación completada es inmutable (invariante de CLAUDE.md).
 */
export class AssessmentSession {
  private constructor(
    readonly id: string,
    readonly userId: string,
    private _status: AssessmentStatus,
    private readonly _answers: RecordedAnswer[],
    private _completedAt: Date | null,
  ) {}

  static start(id: string, userId: string): AssessmentSession {
    return new AssessmentSession(id, userId, 'in_progress', [], null);
  }

  static restore(p: {
    id: string;
    userId: string;
    status: AssessmentStatus;
    answers: RecordedAnswer[];
    completedAt: Date | null;
  }): AssessmentSession {
    return new AssessmentSession(
      p.id,
      p.userId,
      p.status,
      [...p.answers],
      p.completedAt,
    );
  }

  get status() {
    return this._status;
  }
  get answers(): readonly RecordedAnswer[] {
    return this._answers;
  }
  get completedAt() {
    return this._completedAt;
  }
  get canComplete() {
    return (
      this._status === 'in_progress' &&
      this._answers.length >= MIN_ANSWERS_TO_COMPLETE
    );
  }

  /** Lanza el error de estado si la entrevista ya no admite cambios. */
  assertOpen(): void {
    this.assertInProgress();
  }

  answer(
    questionKey: string,
    answer: Answer,
    score: number | null,
  ): RecordedAnswer {
    this.assertInProgress();
    if (this._answers.length >= MAX_QUESTIONS) {
      throw new DomainError(
        'ASSESSMENT_FULL',
        `La entrevista admite como máximo ${MAX_QUESTIONS} respuestas`,
        'conflict',
      );
    }
    if (this._answers.some((a) => a.questionKey === questionKey)) {
      throw new DomainError(
        'ASSESSMENT_ALREADY_ANSWERED',
        'Esa pregunta ya tiene respuesta',
        'conflict',
      );
    }
    const recorded = { questionKey, answer, score };
    this._answers.push(recorded);
    return recorded;
  }

  complete(now: Date): void {
    this.assertInProgress();
    if (this._answers.length < MIN_ANSWERS_TO_COMPLETE) {
      throw new DomainError(
        'ASSESSMENT_TOO_SHORT',
        `Responde al menos ${MIN_ANSWERS_TO_COMPLETE} preguntas antes de terminar`,
        'validation',
      );
    }
    this._status = 'completed';
    this._completedAt = now;
  }

  abandon(): void {
    this.assertInProgress();
    this._status = 'abandoned';
  }

  private assertInProgress(): void {
    if (this._status === 'completed') {
      throw new DomainError(
        'ASSESSMENT_ALREADY_COMPLETED',
        'Esta entrevista ya terminó',
        'conflict',
      );
    }
    if (this._status === 'abandoned') {
      throw new DomainError(
        'ASSESSMENT_ABANDONED',
        'Esta entrevista fue reemplazada por una nueva',
        'conflict',
      );
    }
  }
}
