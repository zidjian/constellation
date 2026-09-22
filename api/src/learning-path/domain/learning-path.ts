import { DomainError } from '../../shared/domain/domain-error';

export const MAX_PATHS_PER_USER = 10;
export const PATH_NAME_MAX = 80;

export type PathStatus = 'active' | 'archived';
export type PathGeneratedBy = 'rules' | 'claude';

export interface PathStep {
  id: string;
  courseSlug: string;
  position: number;
  rationale: string;
  completedAt: Date | null;
}

export interface Progress {
  completed: number;
  total: number;
}

/**
 * Ruta guardada. El progreso se deriva de los pasos (`completedAt`), nunca se almacena
 * (invariante de CLAUDE.md). El orden de los pasos lo fijó el PathPlanner al generarla.
 */
export class LearningPath {
  private constructor(
    readonly id: string,
    readonly userId: string,
    readonly sessionId: string | null,
    private _name: string,
    readonly goal: string,
    private _status: PathStatus,
    readonly generatedBy: PathGeneratedBy,
    private readonly _steps: PathStep[],
    readonly createdAt: Date,
  ) {}

  static create(p: {
    id: string;
    userId: string;
    sessionId: string;
    name: string;
    goal: string;
    generatedBy: PathGeneratedBy;
    steps: Omit<PathStep, 'completedAt'>[];
    now: Date;
  }): LearningPath {
    if (!p.steps.length) {
      throw new DomainError(
        'PATH_EMPTY',
        'Una ruta necesita al menos un paso',
        'validation',
      );
    }
    return new LearningPath(
      p.id,
      p.userId,
      p.sessionId,
      LearningPath.validName(p.name),
      p.goal,
      'active',
      p.generatedBy,
      p.steps.map((s) => ({ ...s, completedAt: null })),
      p.now,
    );
  }

  static restore(p: {
    id: string;
    userId: string;
    sessionId: string | null;
    name: string;
    goal: string;
    status: PathStatus;
    generatedBy: PathGeneratedBy;
    steps: PathStep[];
    createdAt: Date;
  }): LearningPath {
    return new LearningPath(
      p.id,
      p.userId,
      p.sessionId,
      p.name,
      p.goal,
      p.status,
      p.generatedBy,
      [...p.steps].sort((a, b) => a.position - b.position),
      p.createdAt,
    );
  }

  static validName(name: string): string {
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > PATH_NAME_MAX) {
      throw new DomainError(
        'PATH_INVALID_NAME',
        `El nombre debe tener entre 1 y ${PATH_NAME_MAX} caracteres`,
        'validation',
      );
    }
    return trimmed;
  }

  get name() {
    return this._name;
  }
  get status() {
    return this._status;
  }
  get steps(): readonly PathStep[] {
    return this._steps;
  }
  get progress(): Progress {
    return {
      completed: this._steps.filter((s) => s.completedAt).length,
      total: this._steps.length,
    };
  }

  rename(name: string): void {
    this._name = LearningPath.validName(name);
  }

  setStatus(status: PathStatus): void {
    this._status = status;
  }

  /** Idempotente: completar un paso ya completado conserva su fecha original. */
  completeStep(stepId: string, now: Date): PathStep {
    const step = this.step(stepId);
    step.completedAt ??= now;
    return step;
  }

  uncompleteStep(stepId: string): PathStep {
    const step = this.step(stepId);
    step.completedAt = null;
    return step;
  }

  private step(stepId: string): PathStep {
    const step = this._steps.find((s) => s.id === stepId);
    if (!step)
      throw new DomainError(
        'PATH_STEP_NOT_FOUND',
        'Ese paso no existe en la ruta',
        'not_found',
      );
    return step;
  }
}
