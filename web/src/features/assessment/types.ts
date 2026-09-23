// Contrato de /v1/assessments (ver api/src/assessment). La pregunta nunca trae la respuesta correcta.
export type Option = { id: string; label: string; hint?: string };

export type Question =
  | { key: "goal"; type: "text"; prompt: string; placeholder: string }
  | { key: "area" | "stack"; type: "single"; prompt: string; options: Option[] }
  | { key: "self"; type: "scale"; prompt: string; items: { skill: string; label: string }[]; scale: string[] }
  | {
      key: `ch:${string}`;
      type: "challenge";
      prompt: string;
      skill: string;
      difficulty: number;
      code?: string;
      language?: string;
      options: Option[];
    };

export type Answer = { text: string } | { optionId: string } | { levels: Record<string, number> };

export interface AssessmentSession {
  id: string;
  status: "in_progress" | "completed" | "abandoned";
  answeredCount: number;
  maxQuestions: number;
  minToComplete: number;
  canComplete: boolean;
}

/** Simulacro de entrevista: turno del reclutador (ver api/src/assessment/application/recruiter.use-cases.ts). */
export interface RecruiterChallenge {
  id: string;
  skill: string;
  difficulty: number;
  prompt: string;
  code?: string;
  language?: string;
  options: Option[];
}

export interface RecruiterTurn {
  session: AssessmentSession;
  say: string;
  challenge: RecruiterChallenge | null;
  finished: boolean;
}

export interface InterviewReport {
  summary: string;
  strengths: { title: string; quote: string }[];
  gaps: { title: string; note: string }[];
}

export interface SkillProfile {
  levels: Record<string, number>;
  targetSkills: string[];
  goal?: string;
}
