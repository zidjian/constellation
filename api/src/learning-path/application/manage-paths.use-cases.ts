import { Inject, Injectable, Logger } from '@nestjs/common';
import { CatalogGraphProvider } from '../../catalog/application/catalog-graph.provider';
import { DomainError } from '../../shared/domain/domain-error';
import type { LearningPath, PathStatus } from '../domain/learning-path';
import {
  LEARNING_PATH_REPOSITORY,
  type LearningPathRepository,
} from '../domain/ports';
import { courseView, pathDetail, pathSummary } from './path-views';

const notFound = () =>
  new DomainError('PATH_NOT_FOUND', 'No encontramos esa ruta', 'not_found');

// Ownership en cada caso de uso: una ruta de otro usuario no existe para quien la pide.
@Injectable()
export class ManagePathsUseCases {
  private readonly logger = new Logger(ManagePathsUseCases.name);

  constructor(
    @Inject(LEARNING_PATH_REPOSITORY)
    private readonly paths: LearningPathRepository,
    private readonly catalog: CatalogGraphProvider,
  ) {}

  async list(userId: string) {
    return (await this.paths.listForUser(userId)).map(pathSummary);
  }

  /**
   * Cursos que la persona ya encendió, sin repetir: un mismo curso puede estar en varias rutas y
   * cuenta una vez, con la fecha en que lo marcó la primera vez.
   */
  async completedCourses(userId: string) {
    const graph = await this.catalog.get();
    const porCurso = new Map<
      string,
      { completedAt: Date; paths: { id: string; name: string }[] }
    >();

    for (const path of await this.paths.listForUser(userId)) {
      for (const step of path.steps) {
        if (!step.completedAt) continue;
        const previo = porCurso.get(step.courseSlug);
        if (previo) {
          previo.completedAt =
            step.completedAt < previo.completedAt
              ? step.completedAt
              : previo.completedAt;
          previo.paths.push({ id: path.id, name: path.name });
        } else {
          porCurso.set(step.courseSlug, {
            completedAt: step.completedAt,
            paths: [{ id: path.id, name: path.name }],
          });
        }
      }
    }

    const courses = [...porCurso.entries()]
      .flatMap(([slug, dato]) => {
        const course = graph.course(slug);
        // Un curso que salió del catálogo no se inventa: se omite y se cuenta en el log.
        return course ? [{ course: courseView(course), ...dato }] : [];
      })
      .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());

    return {
      courses: courses.map((c) => ({
        course: c.course,
        completedAt: c.completedAt.toISOString(),
        paths: c.paths,
      })),
      totalHours: courses.reduce((h, c) => h + c.course.durationHours, 0),
    };
  }

  async get(userId: string, id: string) {
    const detail = pathDetail(
      await this.load(userId, id),
      await this.catalog.get(),
    );
    // Solo pasaría si el catálogo en memoria quedara desfasado respecto a la BD: no se oculta en silencio.
    const missing = detail.steps.filter((s) => s.course === null).length;
    if (missing)
      this.logger.warn(
        `Ruta ${id}: ${missing} paso(s) sin curso en el catálogo`,
      );
    return detail;
  }

  async update(
    userId: string,
    id: string,
    changes: { name?: string; status?: PathStatus },
  ) {
    const path = await this.load(userId, id);
    if (changes.name !== undefined) path.rename(changes.name);
    if (changes.status !== undefined) path.setStatus(changes.status);
    await this.paths.update(path);
    return pathSummary(path);
  }

  async delete(userId: string, id: string) {
    if (!(await this.paths.delete(id, userId))) throw notFound();
    return { deleted: true };
  }

  async setStepCompletion(
    userId: string,
    id: string,
    stepId: string,
    completed: boolean,
  ) {
    const path = await this.load(userId, id);
    const step = completed
      ? path.completeStep(stepId, new Date())
      : path.uncompleteStep(stepId);
    await this.paths.update(path);
    return {
      step: {
        id: step.id,
        completedAt: step.completedAt?.toISOString() ?? null,
      },
      progress: path.progress,
    };
  }

  private async load(userId: string, id: string): Promise<LearningPath> {
    const path = await this.paths.findForUser(id, userId);
    if (!path) throw notFound();
    return path;
  }
}
