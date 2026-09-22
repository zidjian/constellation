import type { Metadata } from "next";
import { AssessmentFlow } from "@/features/assessment/assessment-flow";

export const metadata: Metadata = { title: "Entrevista · Constellation" };

export default function AssessmentPage() {
  return <AssessmentFlow />;
}
