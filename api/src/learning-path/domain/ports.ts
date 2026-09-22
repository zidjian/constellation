import type { SkillProfile } from '../../assessment/domain/skill-profile';
import type { Course } from '../../catalog/domain/catalog';
import type { LearningPath } from './learning-path';
import type { StepReason } from './path-planner';

export const LEARNING_PATH_REPOSITORY = Symbol('LearningPathRepository');
export interface LearningPathRepository {
  newId(): string;
  countForUser(userId: string): Promise<number>;
  /** Ownership en la consulta: null si no existe o es de otro usuario. */
  findForUser(id: string, userId: string): Promise<LearningPath | null>;
  listForUser(userId: string): Promise<LearningPath[]>;
  /** Crea la ruta con sus pasos en una transacción. */
  create(path: LearningPath): Promise<void>;
  /** Persiste nombre, estado y completedAt de los pasos. */
  update(path: LearningPath): Promise<void>;
  delete(id: string, userId: string): Promise<boolean>;
}

export interface RationaleRequest {
  profile: SkillProfile;
  steps: {
    position: number;
    course: Course;
    reason: StepReason;
    dependents: Course[];
  }[];
  skillNames: Record<string, string>;
}

export const RATIONALE_WRITER = Symbol('RationaleWriterPort');
export interface RationaleWriterPort {
  readonly name: 'claude' | 'rules';
  /** Texto del "por qué" de cada paso ya decidido, en el mismo orden. No puede añadir ni quitar pasos. */
  write(request: RationaleRequest): Promise<string[]>;
}
