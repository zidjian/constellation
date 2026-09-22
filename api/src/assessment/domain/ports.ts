import type { AssessmentSession } from './assessment-session';
import type { SkillProfile } from './skill-profile';

export const ASSESSMENT_REPOSITORY = Symbol('AssessmentRepository');
export interface AssessmentRepository {
  newId(): string;
  /** Sesión del usuario (ownership): null si no existe o es de otro. */
  findForUser(id: string, userId: string): Promise<AssessmentSession | null>;
  findInProgress(userId: string): Promise<AssessmentSession | null>;
  /** Persiste estado y respuestas nuevas; con perfil, en la misma transacción. */
  save(
    session: AssessmentSession,
    profile?: { profile: SkillProfile; interpretedBy: string },
  ): Promise<void>;
  findProfile(
    sessionId: string,
  ): Promise<{ profile: SkillProfile; interpretedBy: string } | null>;
}

/** Lo que la entrevista sabe del usuario, ya estructurado para el intérprete. */
export interface InterpreterInput {
  goal: string;
  area: string | null;
  stackTargets: string[];
  selfLevels: Record<string, number>;
  challenges: { skill: string; difficulty: number; correct: boolean }[];
  /** Skills válidas del catálogo: la salida se filtra contra esto. */
  knownSkills: { slug: string; name: string }[];
}

export interface Interpretation {
  profile: SkillProfile;
  /** Quién produjo el perfil de verdad (con fallback puede ser 'rules' aunque se pidiera Claude). */
  by: 'claude' | 'rules';
}

export const SKILL_INTERPRETER = Symbol('SkillInterpreterPort');
export interface SkillInterpreterPort {
  interpret(input: InterpreterInput): Promise<Interpretation>;
}
