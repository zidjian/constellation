// Perfil que produce la entrevista (SkillInterpreterPort) y consume el PathPlanner.
export const SKILL_LEVEL_MIN = 0;
export const SKILL_LEVEL_MAX = 3;
/** Nivel a partir del cual una skill se considera dominada (plan §12). */
export const MASTERY_THRESHOLD = 2;

export interface SkillProfile {
  /** slug de skill → nivel 0..3 (0 = nada, 3 = experto). Lo ausente cuenta como 0. */
  levels: Record<string, number>;
  /** Skills que la persona quiere aprender, en orden de prioridad. */
  targetSkills: string[];
  goal?: string;
}

export const isMastered = (profile: SkillProfile, skill: string): boolean =>
  (profile.levels[skill] ?? 0) >= MASTERY_THRESHOLD;
