import { Inject, Injectable, Logger } from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  ASSESSMENT_REPOSITORY,
  type AssessmentRepository,
} from '../../assessment/domain/ports';
import type { SkillProfile } from '../../assessment/domain/skill-profile';
import { CatalogGraphProvider } from '../../catalog/application/catalog-graph.provider';
import type { CatalogGraph } from '../../catalog/domain/catalog-graph';
import { DomainError } from '../../shared/domain/domain-error';
import { LearningPath, MAX_PATHS_PER_USER } from '../domain/learning-path';
import { PathPlanner, type PlannedPath } from '../domain/path-planner';
import {
  LEARNING_PATH_REPOSITORY,
  type LearningPathRepository,
  RATIONALE_WRITER,
  type RationaleWriterPort,
} from '../domain/ports';
import { courseView, pathEdges } from './path-views';

export type GenerationEvent =
  | {
      event: 'profile';
      data: {
        targetSkills: string[];
        levels: Record<string, number>;
        uncoveredTargets: string[];
      };
    }
  | {
      event: 'step';
      data: {
        position: number;
        course: ReturnType<typeof courseView>;
        reason: PlannedPath['steps'][number]['reason'];
        prerequisites: string[];
      };
    }
  | {
      event: 'rationale';
      data: { position: number; courseSlug: string; text: string };
    }
  | {
      event: 'done';
      data: { pathId: string; steps: number; truncated: boolean };
    };

export interface GenerationPlan {
  userId: string;
  sessionId: string;
  name: string;
  profile: SkillProfile;
  planned: PlannedPath;
  graph: CatalogGraph;
}

@Injectable()
export class GeneratePathUseCase {
  private readonly logger = new Logger(GeneratePathUseCase.name);

  constructor(
    @Inject(ASSESSMENT_REPOSITORY)
    private readonly assessments: AssessmentRepository,
    @Inject(LEARNING_PATH_REPOSITORY)
    private readonly paths: LearningPathRepository,
    @Inject(RATIONALE_WRITER) private readonly rationale: RationaleWriterPort,
    private readonly catalog: CatalogGraphProvider,
  ) {}

  /** Todo lo que puede fallar "de forma normal" se valida aquí, antes de abrir el stream. */
  async prepare(
    userId: string,
    assessmentId: string,
    rawName: string,
  ): Promise<GenerationPlan> {
    const session = await this.assessments.findForUser(assessmentId, userId);
    if (!session)
      throw new DomainError(
        'ASSESSMENT_NOT_FOUND',
        'No encontramos esa entrevista',
        'not_found',
      );
    if (session.status !== 'completed') {
      throw new DomainError(
        'ASSESSMENT_NOT_COMPLETED',
        'Termina la entrevista antes de generar la ruta',
        'conflict',
      );
    }
    const stored = await this.assessments.findProfile(session.id);
    if (!stored)
      throw new DomainError(
        'ASSESSMENT_NOT_COMPLETED',
        'La entrevista no tiene perfil',
        'conflict',
      );

    const name = LearningPath.validName(rawName);
    if ((await this.paths.countForUser(userId)) >= MAX_PATHS_PER_USER) {
      throw new DomainError(
        'PATH_LIMIT_REACHED',
        `Tienes el máximo de ${MAX_PATHS_PER_USER} rutas. Elimina alguna para crear otra.`,
        'conflict',
      );
    }

    const graph = await this.catalog.get();
    const planned = new PathPlanner(graph).plan(stored.profile); // PATH_NOTHING_TO_LEARN sale de aquí
    return {
      userId,
      sessionId: session.id,
      name,
      profile: stored.profile,
      planned,
      graph,
    };
  }

  /** Emite la ruta paso a paso y la persiste justo antes de `done`. Si el cliente corta, no guarda nada. */
  async *run(
    plan: GenerationPlan,
    signal: AbortSignal,
    /** Pausa entre eventos: ritmo de presentación, lo decide el controller. */
    delayMs: number,
  ): AsyncGenerator<GenerationEvent> {
    const { graph, planned, profile } = plan;
    const delay = () =>
      delayMs ? sleep(delayMs, undefined, { signal }) : null;
    const slugs = planned.steps.map((s) => s.courseSlug);
    const edges = pathEdges(slugs, graph);

    // Se pide ya: la redacción (Claude, hasta LLM_TIMEOUT_MS) corre mientras se emiten los pasos.
    const rationaleWork = this.rationale.write(
      {
        profile,
        skillNames: Object.fromEntries(
          graph.catalog.skills.map((s) => [s.slug, s.name]),
        ),
        steps: planned.steps.map((s, position) => ({
          position,
          course: graph.course(s.courseSlug)!,
          reason: s.reason,
          dependents:
            s.reason.kind === 'prerequisite'
              ? s.reason.for.map((d) => graph.course(d)!)
              : [],
        })),
      },
      signal,
    );
    yield {
      event: 'profile',
      data: {
        targetSkills: profile.targetSkills,
        levels: profile.levels,
        uncoveredTargets: planned.uncoveredTargets,
      },
    };

    for (const [position, step] of planned.steps.entries()) {
      await delay();
      yield {
        event: 'step',
        data: {
          position,
          course: courseView(graph.course(step.courseSlug)!),
          reason: step.reason,
          prerequisites: edges
            .filter((e) => e.to === step.courseSlug)
            .map((e) => e.from),
        },
      };
    }

    const { texts, by } = await rationaleWork;
    for (const [position, text] of texts.entries()) {
      await delay();
      yield {
        event: 'rationale',
        data: { position, courseSlug: slugs[position], text },
      };
    }

    signal.throwIfAborted();
    const path = LearningPath.create({
      id: this.paths.newId(),
      userId: plan.userId,
      sessionId: plan.sessionId,
      name: plan.name,
      goal: profile.goal ?? '',
      generatedBy: by,
      steps: planned.steps.map((s, position) => ({
        id: this.paths.newId(),
        courseSlug: s.courseSlug,
        position,
        rationale: texts[position] ?? '',
      })),
      now: new Date(),
    });
    await this.paths.create(path);
    this.logger.log(`Ruta ${path.id} creada: ${slugs.length} pasos (${by})`);
    yield {
      event: 'done',
      data: {
        pathId: path.id,
        steps: slugs.length,
        truncated: planned.truncated,
      },
    };
  }
}
