// Modelo de lectura del catálogo (seed versionado, ADR-0004). Sin dependencias de framework.
export const SKILL_AREAS = [
  'fundamentals',
  'frontend',
  'backend',
  'mobile',
  'devops',
] as const;
export type SkillArea = (typeof SKILL_AREAS)[number];

export const COURSE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];

export interface Skill {
  slug: string;
  name: string;
  area: SkillArea;
}

export interface Course {
  slug: string;
  title: string;
  url: string;
  imageUrl: string;
  summary: string;
  level: CourseLevel;
  durationHours: number;
  /** Skills que enseña: lo que el planner usa para cubrir objetivos. */
  teaches: string[];
  /** Skills que conviene traer: informativo, el planner no cierra sobre esto. */
  requires: string[];
  /** Cursos que deben ir antes: prerrequisitos duros (DAG). */
  prerequisites: string[];
}

export interface Catalog {
  skills: Skill[];
  courses: Course[];
}
