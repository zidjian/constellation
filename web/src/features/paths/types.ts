// Contrato de /v1/paths (ver api/src/learning-path).
export interface Course {
  slug: string;
  title: string;
  url: string;
  imageUrl: string;
  summary: string;
  level: "beginner" | "intermediate" | "advanced";
  durationHours: number;
}

export interface Progress {
  completed: number;
  total: number;
}

export interface PathSummary {
  id: string;
  name: string;
  goal: string;
  status: "active" | "archived";
  generatedBy: "rules" | "claude";
  createdAt: string;
  progress: Progress;
}

export interface PathStep {
  id: string;
  position: number;
  rationale: string;
  completedAt: string | null;
  course: Course | null;
}

export interface PathDetail extends PathSummary {
  steps: PathStep[];
  edges: { from: string; to: string }[];
}

export type StepReason = { kind: "target"; skills: string[] } | { kind: "prerequisite"; for: string[] };

/** Eventos del stream de POST /v1/paths/generate. */
export type GenerationEvent =
  | { event: "profile"; data: { targetSkills: string[]; levels: Record<string, number>; uncoveredTargets: string[] } }
  | { event: "step"; data: { position: number; course: Course; reason: StepReason; prerequisites: string[] } }
  | { event: "rationale"; data: { position: number; courseSlug: string; text: string } }
  | { event: "done"; data: { pathId: string; steps: number; truncated: boolean } }
  | { event: "error"; data: { code: string; message: string } };

export const LEVEL_LABEL: Record<Course["level"], string> = {
  beginner: "Inicial",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};
