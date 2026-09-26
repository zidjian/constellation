import type { AssessmentSession } from '../domain/assessment-session';
import { MIN_ANSWERS_TO_COMPLETE, type Question } from '../domain/questions';

export interface AssessmentView {
  id: string;
  /** La web necesita saberlo: una sesión de simulacro no se responde con el flujo guiado. */
  mode: AssessmentSession['mode'];
  status: AssessmentSession['status'];
  answeredCount: number;
  maxQuestions: number;
  minToComplete: number;
  canComplete: boolean;
}

export const toView = (s: AssessmentSession): AssessmentView => ({
  id: s.id,
  mode: s.mode,
  status: s.status,
  answeredCount: s.answers.length,
  maxQuestions: s.maxAnswers,
  minToComplete: MIN_ANSWERS_TO_COMPLETE,
  canComplete: s.canComplete,
});

/** Pregunta tal como sale de la API: nunca incluye la respuesta correcta (Question no la tiene). */
export type PublicQuestion = Question;
