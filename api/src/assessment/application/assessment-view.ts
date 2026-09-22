import type { AssessmentSession } from '../domain/assessment-session';
import {
  MAX_QUESTIONS,
  MIN_ANSWERS_TO_COMPLETE,
  type Question,
} from '../domain/questions';

export interface AssessmentView {
  id: string;
  status: AssessmentSession['status'];
  answeredCount: number;
  maxQuestions: number;
  minToComplete: number;
  canComplete: boolean;
}

export const toView = (s: AssessmentSession): AssessmentView => ({
  id: s.id,
  status: s.status,
  answeredCount: s.answers.length,
  maxQuestions: MAX_QUESTIONS,
  minToComplete: MIN_ANSWERS_TO_COMPLETE,
  canComplete: s.canComplete,
});

/** Pregunta tal como sale de la API: nunca incluye la respuesta correcta (Question no la tiene). */
export type PublicQuestion = Question;
