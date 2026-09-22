import { apiFetch } from "@/lib/api";
import type { Answer, AssessmentSession, Question, SkillProfile } from "./types";

type WithQuestion = { session: AssessmentSession; question: Question };

export const startAssessment = () => apiFetch<WithQuestion>("/assessments", { method: "POST" });

export const currentAssessment = () =>
  apiFetch<{ session: AssessmentSession; question: Question | null } | null>("/assessments/current");

export const answerQuestion = (id: string, questionKey: string, answer: Answer) =>
  apiFetch<{ session: AssessmentSession; result: { correct: boolean } | null; next: Question | null }>(
    `/assessments/${id}/answers`,
    { method: "POST", body: JSON.stringify({ questionKey, answer }) },
  );

export const completeAssessment = (id: string) =>
  apiFetch<{ session: AssessmentSession; profile: SkillProfile }>(`/assessments/${id}/complete`, { method: "POST" });

export const catalogSkills = () =>
  apiFetch<{ skills: { slug: string; name: string }[] }>("/catalog/courses").then((c) =>
    Object.fromEntries(c.skills.map((s) => [s.slug, s.name])),
  );
