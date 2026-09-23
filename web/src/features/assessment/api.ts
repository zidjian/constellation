import { apiFetch } from "@/lib/api";
import type {
  Answer,
  AssessmentSession,
  InterviewReport,
  Question,
  RecruiterTurn,
  SkillProfile,
} from "./types";

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
  apiFetch<{ session: AssessmentSession; profile: SkillProfile; report?: InterviewReport }>(
    `/assessments/${id}/complete`,
    { method: "POST" },
  );

/** El simulacro solo se ofrece si el servidor lo tiene activo (depende de la IA). */
export const assessmentModes = () => apiFetch<{ recruiter: boolean }>("/assessments/modes");

export const startRecruiter = (jobOffer: string) =>
  apiFetch<RecruiterTurn>("/assessments/recruiter", { method: "POST", body: JSON.stringify({ jobOffer }) });

export const replyRecruiter = (id: string, reply: { text: string } | { optionId: string }) =>
  apiFetch<RecruiterTurn>(`/assessments/${id}/recruiter/reply`, { method: "POST", body: JSON.stringify(reply) });

export const assessmentReport = (id: string) => apiFetch<InterviewReport | null>(`/assessments/${id}/report`);

export const catalogSkills = () =>
  apiFetch<{ skills: { slug: string; name: string }[] }>("/catalog/courses").then((c) =>
    Object.fromEntries(c.skills.map((s) => [s.slug, s.name])),
  );
