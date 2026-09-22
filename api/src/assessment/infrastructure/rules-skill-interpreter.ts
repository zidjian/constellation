import { Injectable } from '@nestjs/common';
import { SKILL_LEVEL_MAX, type SkillProfile } from '../domain/skill-profile';
import type { InterpreterInput, SkillInterpreterPort } from '../domain/ports';

const MAX_TARGETS = 4;

// Palabras del texto libre que no coinciden con el nombre de la skill tal cual.
const ALIASES: Record<string, string> = {
  node: 'nodejs',
  'node.js': 'nodejs',
  express: 'nodejs',
  nest: 'nestjs',
  postgres: 'sql',
  postgresql: 'sql',
  mysql: 'sql',
  'base de datos': 'sql',
  'bases de datos': 'sql',
  k8s: 'kubernetes',
  spring: 'spring-boot',
  '.net': 'dotnet',
  'c#': 'csharp',
  golang: 'go-backend',
  llm: 'llm-apps',
  llms: 'llm-apps',
  chatgpt: 'llm-apps',
  openai: 'llm-apps',
  'inteligencia artificial': 'llm-apps',
  next: 'nextjs',
  'next.js': 'nextjs',
  tailwind: 'tailwindcss',
  testing: 'automated-testing',
  pruebas: 'automated-testing',
  microservicios: 'microservices',
  'arquitectura limpia': 'clean-architecture',
  'clean architecture': 'clean-architecture',
  'tiempo real': 'websockets',
  sockets: 'websockets',
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Límites de palabra que admiten símbolos (c#, .net, node.js).
const mentions = (text: string, term: string) =>
  new RegExp(
    `(^|[^\\p{L}\\p{N}])${escape(term)}($|[^\\p{L}\\p{N}])`,
    'iu',
  ).test(text);

/**
 * Intérprete por reglas: sin red, determinista. Es el camino obligatorio de la demo (ADR-0001)
 * y el fallback del adaptador Claude.
 */
@Injectable()
export class RulesSkillInterpreter implements SkillInterpreterPort {
  readonly name = 'rules' as const;

  interpret(input: InterpreterInput): Promise<SkillProfile> {
    const known = new Set(input.knownSkills.map((s) => s.slug));

    // Niveles: la autoevaluación como base y los retos por encima (evidencia > percepción).
    const levels: Record<string, number> = { ...input.selfLevels };
    const bySkill = new Map<
      string,
      { difficulty: number; correct: boolean }[]
    >();
    for (const ch of input.challenges)
      bySkill.set(ch.skill, [...(bySkill.get(ch.skill) ?? []), ch]);
    for (const [skill, results] of bySkill) {
      const passed = Math.max(
        0,
        ...results.filter((r) => r.correct).map((r) => r.difficulty),
      );
      const failedAt = Math.min(
        Infinity,
        ...results.filter((r) => !r.correct).map((r) => r.difficulty),
      );
      levels[skill] = Number.isFinite(failedAt)
        ? Math.min(passed, failedAt - 1)
        : Math.max(passed, levels[skill] ?? 0);
    }

    // Objetivos: primero lo que eligió, luego lo que menciona en el texto libre.
    const fromText = this.skillsMentioned(input.goal, input.knownSkills);
    const targetSkills = [...new Set([...input.stackTargets, ...fromText])]
      .filter((s) => known.has(s))
      .slice(0, MAX_TARGETS);

    return Promise.resolve({
      levels: Object.fromEntries(
        Object.entries(levels)
          .filter(([s]) => known.has(s))
          .map(([s, l]) => [
            s,
            Math.max(0, Math.min(SKILL_LEVEL_MAX, Math.round(l))),
          ]),
      ),
      targetSkills,
      goal: input.goal,
    });
  }

  private skillsMentioned(
    goal: string,
    knownSkills: { slug: string; name: string }[],
  ): string[] {
    const found: { skill: string; at: number }[] = [];
    const push = (skill: string, term: string) => {
      const at = goal.toLowerCase().indexOf(term.toLowerCase());
      if (at >= 0 && mentions(goal, term)) found.push({ skill, at });
    };
    for (const s of knownSkills) {
      push(s.slug, s.slug);
      push(s.slug, s.name);
    }
    for (const [term, skill] of Object.entries(ALIASES)) push(skill, term);
    // En el orden en que aparecen en el texto.
    return [...new Set(found.sort((a, b) => a.at - b.at).map((f) => f.skill))];
  }
}
