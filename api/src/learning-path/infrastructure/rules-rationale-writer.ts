import { Injectable } from '@nestjs/common';
import type { RationaleRequest, RationaleWriterPort } from '../domain/ports';

const list = (items: string[]) =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`;

/** Explicación por plantillas: sin red, determinista. Fallback del adaptador Claude (ADR-0001). */
@Injectable()
export class RulesRationaleWriter implements RationaleWriterPort {
  readonly name = 'rules' as const;

  write({ profile, steps, skillNames }: RationaleRequest): Promise<string[]> {
    const name = (s: string) => skillNames[s] ?? s;
    return Promise.resolve(
      steps.map(({ course, reason, dependents }) => {
        const teaches = list(course.teaches.map(name));
        const parts: string[] = [];
        if (reason.kind === 'target') {
          parts.push(
            `Va directo a tu objetivo. Aquí aprendes ${list(reason.skills.map(name))}.`,
          );
        } else if (dependents.length) {
          parts.push(
            `Es la base de ${list(dependents.map((d) => `«${d.title}»`))}. Aquí aprendes ${teaches}.`,
          );
        } else {
          parts.push(`Te prepara para lo que viene. Aquí aprendes ${teaches}.`);
        }
        const partial = course.teaches.filter(
          (s) => (profile.levels[s] ?? 0) === 1,
        );
        if (partial.length) {
          parts.push(
            `Ya tienes nociones de ${list(partial.map(name))}; este curso las consolida.`,
          );
        }
        parts.push(
          `Son unas ${course.durationHours} h de nivel ${LEVEL_ES[course.level]}.`,
        );
        return parts.join(' ');
      }),
    );
  }
}

const LEVEL_ES = {
  beginner: 'inicial',
  intermediate: 'intermedio',
  advanced: 'avanzado',
} as const;
