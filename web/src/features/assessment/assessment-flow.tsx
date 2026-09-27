"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Star } from "@/components/ui/star";
import { GenerationView } from "@/features/paths/generation-view";
import { ApiError } from "@/lib/api";
import { answerQuestion, assessmentModes, completeAssessment, currentAssessment, startAssessment } from "./api";
import { RecruiterFlow } from "./recruiter-flow";
import { Summary } from "./summary";
import { ChallengeQuestion, ChoiceQuestion, ScaleQuestion, TextQuestion } from "./questions";
import type { Answer, AssessmentSession, Question, SkillProfile } from "./types";

type Phase =
  | { kind: "loading" }
  | { kind: "intro"; resumable: { session: AssessmentSession; question: Question | null } | null }
  | { kind: "question"; session: AssessmentSession; question: Question }
  | { kind: "feedback"; session: AssessmentSession; correct: boolean; next: Question | null }
  | { kind: "summary"; session: AssessmentSession; profile: SkillProfile }
  | { kind: "generating"; sessionId: string; name: string };

const ease = [0.22, 1, 0.36, 1] as const;

export function AssessmentFlow() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  // El simulacro depende de la IA: si el servidor lo tiene apagado, ni se ofrece.
  const [recruiter, setRecruiter] = useState(false);
  const [inRecruiter, setInRecruiter] = useState<{ resumeId?: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    assessmentModes()
      .then((m) => setRecruiter(m.recruiter))
      .catch(() => setRecruiter(false));
  }, []);

  useEffect(() => {
    currentAssessment()
      .then((current) => setPhase({ kind: "intro", resumable: current }))
      .catch(() => setPhase({ kind: "intro", resumable: null }));
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setPending(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Algo falló. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  };

  const finish = (session: AssessmentSession) =>
    run(async () => {
      const { profile, session: done } = await completeAssessment(session.id);
      setPhase({ kind: "summary", session: done, profile });
    });

  const goTo = (session: AssessmentSession, question: Question | null) =>
    question ? setPhase({ kind: "question", session, question }) : void finish(session);

  const start = () =>
    run(async () => {
      const { session, question } = await startAssessment();
      setPhase({ kind: "question", session, question });
    });

  const submit = (session: AssessmentSession, question: Question, answer: Answer) =>
    run(async () => {
      const r = await answerQuestion(session.id, question.key, answer);
      if (r.result) setPhase({ kind: "feedback", session: r.session, correct: r.result.correct, next: r.next });
      else goTo(r.session, r.next);
    });

  const key =
    phase.kind === "question" ? phase.question.key : phase.kind === "feedback" ? `fb-${phase.session.answeredCount}` : phase.kind;

  if (inRecruiter)
    return <RecruiterFlow onBack={() => setInRecruiter(null)} resumeId={inRecruiter.resumeId} />;

  if (phase.kind === "generating") return <GenerationView assessmentId={phase.sessionId} name={phase.name} />;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      {(phase.kind === "question" || phase.kind === "feedback") && <Horizon session={phase.session} />}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={key}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease }}
        >
          {phase.kind === "loading" && <IntroSkeleton />}

          {phase.kind === "intro" && (
            <Intro
              resumable={phase.resumable}
              pending={pending}
              recruiter={recruiter}
              onRecruiter={() => setInRecruiter({})}
              onResumeRecruiter={(id) => setInRecruiter({ resumeId: id })}
              onStart={start}
              onResume={() => phase.resumable && goTo(phase.resumable.session, phase.resumable.question)}
            />
          )}

          {phase.kind === "question" && (
            <QuestionSwitch question={phase.question} pending={pending} onSubmit={(a) => submit(phase.session, phase.question, a)} />
          )}

          {phase.kind === "feedback" && (
            <Feedback correct={phase.correct} pending={pending} onContinue={() => goTo(phase.session, phase.next)} />
          )}

          {phase.kind === "summary" && (
            <Summary
              profile={phase.profile}
              onGenerate={(name) => setPhase({ kind: "generating", sessionId: phase.session.id, name })}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {error && (
        <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {phase.kind === "question" && phase.session.canComplete && (
        <div className="flex items-center justify-between gap-3 border-t border-line pt-5 text-sm">
          <span className="text-ink-muted">Ya tenemos lo suficiente para trazar tu ruta.</span>
          <Button variant="secondary" size="sm" onClick={() => finish(phase.session)} disabled={pending}>
            Terminar ahora
          </Button>
        </div>
      )}
    </div>
  );
}

function QuestionSwitch({ question, pending, onSubmit }: { question: Question; pending: boolean; onSubmit: (a: Answer) => void }) {
  switch (question.type) {
    case "text":
      return <TextQuestion question={question} pending={pending} onSubmit={onSubmit} />;
    case "single":
      return <ChoiceQuestion question={question} pending={pending} onSubmit={onSubmit} />;
    case "scale":
      return <ScaleQuestion question={question} pending={pending} onSubmit={onSubmit} />;
    case "challenge":
      return <ChallengeQuestion question={question} pending={pending} onSubmit={onSubmit} />;
  }
}

/**
 * Progreso como línea de horizonte: se llena de izquierda a derecha con cada respuesta. Al terminar
 * la entrevista, esa línea es la primera que se dibuja entre dos estrellas de la constelación.
 */
function Horizon({ session }: { session: AssessmentSession }) {
  const done = session.answeredCount;
  const total = Math.max(session.maxQuestions, done + 1);
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="relative h-px flex-1 overflow-visible bg-line"
        role="presentation"
      >
        <span
          className="absolute inset-y-0 left-0 bg-primary shadow-[0_0_12px_var(--color-glow)] transition-[width] duration-500 ease-out-quint"
          style={{ width: `${Math.round((done / total) * 100)}%` }}
        />
      </span>
      <span className="text-xs text-ink-muted tabular-nums" aria-live="polite">
        {done + 1} / {total}
      </span>
    </div>
  );
}

function Intro({
  resumable,
  pending,
  recruiter,
  onRecruiter,
  onResumeRecruiter,
  onStart,
  onResume,
}: {
  resumable: { session: AssessmentSession; question: Question | null } | null;
  pending: boolean;
  recruiter: boolean;
  onRecruiter: () => void;
  onResumeRecruiter: (id: string) => void;
  onStart: () => void;
  onResume: () => void;
}) {
  // Un simulacro a medias no se responde con estas preguntas: se retoma en su chat.
  const pendingRecruiter = resumable?.session.mode === "recruiter" ? resumable.session : null;
  const [mode, setMode] = useState<"guided" | "recruiter">("guided");

  if (pendingRecruiter || resumable) {
    const esSimulacro = Boolean(pendingRecruiter);
    return (
      <section className="flex flex-col items-start gap-5 py-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">Lo dejaste a medias</h1>
        <p className="max-w-[58ch] leading-relaxed text-ink-muted">
          {esSimulacro
            ? "Tu simulacro de entrevista sigue abierto: el reclutador te espera donde lo dejaste."
            : `Llevas ${resumable!.session.answeredCount} respuestas de tu entrevista.`}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            size="lg"
            variant="accent"
            autoFocus
            onClick={() => (esSimulacro ? onResumeRecruiter(pendingRecruiter!.id) : onResume())}
          >
            {esSimulacro ? "Volver a la entrevista" : "Continuar donde la dejé"}
          </Button>
          <Button size="lg" variant="secondary" onClick={onStart} loading={pending}>
            {esSimulacro ? "Mejor hazme las preguntas" : "Empezar de nuevo"}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-7 py-4">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">Empecemos</h1>
        <p className="mt-2 max-w-[58ch] leading-relaxed text-ink-muted">
          Necesitamos conocerte para trazar tu ruta sobre el catálogo real de DevTalles. Elige cómo prefieres contárnoslo.
        </p>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Cómo quieres hacer la entrevista</legend>
        <ModeOption
          id="guided"
          checked={mode === "guided"}
          onSelect={() => setMode("guided")}
          title="Preguntas rápidas"
          time="3 min"
          detail="Qué quieres lograr, qué tecnología te atrae y unos mini-retos de código para medir tu nivel de verdad."
        />
        {recruiter && (
          <ModeOption
            id="recruiter"
            checked={mode === "recruiter"}
            onSelect={() => setMode("recruiter")}
            title="Simulacro de entrevista"
            time="8 min"
            detail="Un reclutador técnico te entrevista sobre el puesto al que apuntas, repregunta y te da una devolución antes de trazar la ruta."
          />
        )}
      </fieldset>

      <Button
        size="lg"
        variant="accent"
        className="self-start"
        loading={pending}
        onClick={() => (mode === "recruiter" ? onRecruiter() : onStart())}
      >
        {mode === "recruiter" ? "Entrar a la entrevista" : "Empezar"}
      </Button>
    </section>
  );
}

/** Los dos modos tienen la misma dignidad: se eligen, no compiten como CTA y botón fantasma. */
function ModeOption({
  id,
  checked,
  onSelect,
  title,
  time,
  detail,
}: {
  id: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  time: string;
  detail: string;
}) {
  return (
    <label
      className={
        "flex cursor-pointer gap-3.5 rounded-xl border px-4 py-4 transition-[border-color,background-color] duration-150 ease-out-quint " +
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent " +
        (checked ? "border-accent bg-surface" : "border-line bg-surface/40 hover:border-line-strong")
      }
    >
      <input
        type="radio"
        name="modo-entrevista"
        value={id}
        checked={checked}
        onChange={onSelect}
        className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
      />
      <span className="min-w-0">
        <span className="flex flex-wrap items-baseline gap-x-2.5">
          <span className="font-medium">{title}</span>
          <span className="text-xs text-ink-muted tabular-nums">{time}</span>
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-ink-muted">{detail}</span>
      </span>
    </label>
  );
}

function IntroSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-4 py-6">
      <span className="h-9 w-2/3 animate-pulse rounded bg-surface-2" />
      <span className="h-5 w-full animate-pulse rounded bg-surface-2" />
      <span className="h-5 w-4/5 animate-pulse rounded bg-surface-2" />
    </div>
  );
}

function Feedback({ correct, pending, onContinue }: { correct: boolean; pending: boolean; onContinue: () => void }) {
  const reduce = useReducedMotion();
  return (
    <section
      aria-live="assertive"
      className={`flex flex-col items-start gap-5 rounded-lg px-6 py-8 ${correct ? "bg-primary-soft" : "bg-surface"}`}
    >
      <motion.div
        initial={reduce ? false : { scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <Star state={correct ? "completed" : "locked"} size={44} glow />
      </motion.div>
      <div>
        <h2 className="text-2xl font-semibold">{correct ? "¡Correcto!" : "No era esa"}</h2>
        <p className="mt-1 text-ink-muted">
          {correct ? "Subimos un poco la dificultad." : "Sin problema: así ajustamos la ruta a tu nivel real."}
        </p>
      </div>
      <Button onClick={onContinue} loading={pending} autoFocus>
        Continuar
      </Button>
    </section>
  );
}
