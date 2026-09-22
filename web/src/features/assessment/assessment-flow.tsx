"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Star } from "@/components/ui/star";
import { GenerationView } from "@/features/paths/generation-view";
import { ApiError } from "@/lib/api";
import { answerQuestion, catalogSkills, completeAssessment, currentAssessment, startAssessment } from "./api";
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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reduce = useReducedMotion();

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

  if (phase.kind === "generating") return <GenerationView assessmentId={phase.sessionId} name={phase.name} />;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      {(phase.kind === "question" || phase.kind === "feedback") && <ProgressDots session={phase.session} />}

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

/** Una estrella por pregunta posible: se encienden al responder (progreso real, no decorativo). */
function ProgressDots({ session }: { session: AssessmentSession }) {
  const current = session.answeredCount + 1;
  return (
    <div className="flex items-center justify-between gap-4">
      <ol aria-label={`Pregunta ${current} de hasta ${session.maxQuestions}`} className="flex items-center gap-1.5">
        {Array.from({ length: session.maxQuestions }, (_, i) => (
          <li
            key={i}
            aria-hidden
            className={
              "size-2.5 rounded-full transition-[background-color,transform] duration-200 ease-out-quint " +
              (i < session.answeredCount
                ? "bg-primary shadow-[0_0_6px_var(--color-glow)]"
                : i === session.answeredCount
                  ? "scale-125 bg-accent"
                  : "bg-line-strong")
            }
          />
        ))}
      </ol>
      <span className="text-sm text-ink-muted tabular-nums">
        {current} / {session.maxQuestions}
      </span>
    </div>
  );
}

function Intro({
  resumable,
  pending,
  onStart,
  onResume,
}: {
  resumable: { session: AssessmentSession; question: Question | null } | null;
  pending: boolean;
  onStart: () => void;
  onResume: () => void;
}) {
  return (
    <section className="flex flex-col items-start gap-5 py-6">
      <h1 className="text-3xl font-semibold sm:text-4xl">Vamos a trazar tu ruta</h1>
      <p className="max-w-[60ch] text-lg leading-relaxed text-ink-muted">
        Son hasta 10 preguntas: qué quieres lograr, qué tecnología te atrae, qué tanto sabes y unos mini-retos de código
        para medirlo de verdad. Toma unos 3 minutos.
      </p>
      {resumable ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">
            Tienes una entrevista a medias ({resumable.session.answeredCount} respuestas).
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={onResume} autoFocus>
              Continuar donde la dejé
            </Button>
            <Button size="lg" variant="secondary" onClick={onStart} loading={pending}>
              Empezar de nuevo
            </Button>
          </div>
        </div>
      ) : (
        <Button size="lg" onClick={onStart} loading={pending} autoFocus>
          Empezar
        </Button>
      )}
    </section>
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

function Summary({ profile, onGenerate }: { profile: SkillProfile; onGenerate: (name: string) => void }) {
  const [names, setNames] = useState<Record<string, string>>({});
  const nameOf = (s: string) => names[s] ?? s;
  const targets = profile.targetSkills.map(nameOf);
  const [name, setName] = useState("");
  const inputId = useId();
  useEffect(() => void catalogSkills().then(setNames).catch(() => {}), []);
  const suggested = targets.length ? `Ruta hacia ${targets[0]}` : "Mi ruta";
  const strong = Object.entries(profile.levels).filter(([, l]) => l >= 2).map(([s]) => nameOf(s));

  return (
    <section className="flex flex-col gap-7 py-2">
      <div>
        <h1 className="text-3xl font-semibold">Esto es lo que vimos</h1>
        <p className="mt-2 text-ink-muted">Con esto trazamos tu constelación sobre el catálogo real de DevTalles.</p>
      </div>
      <dl className="grid gap-5 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-ink-muted">Quieres aprender</dt>
          <dd className="mt-2 flex flex-wrap gap-2">
            {targets.length ? (
              targets.map((t) => (
                <span key={t} className="rounded-full bg-primary-soft px-3 py-1 text-sm font-medium text-primary-strong">
                  {t}
                </span>
              ))
            ) : (
              <span className="text-sm">Lo que elegiste en la entrevista</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-ink-muted">Ya dominas</dt>
          <dd className="mt-2 flex flex-wrap gap-2">
            {strong.length ? (
              strong.map((t) => (
                <span key={t} className="rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent">
                  {t}
                </span>
              ))
            ) : (
              <span className="text-sm">Partimos desde la base, sin saltarnos nada.</span>
            )}
          </dd>
        </div>
      </dl>
      <form
        className="flex flex-col gap-3 border-t border-line pt-6"
        onSubmit={(e) => {
          e.preventDefault();
          onGenerate((name.trim() || suggested).slice(0, 80));
        }}
      >
        <label htmlFor={inputId} className="font-medium">
          Ponle nombre a tu ruta
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id={inputId}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder={suggested}
            className="h-12 flex-1 rounded-md border border-line-strong bg-bg px-4 placeholder:text-ink-muted focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
          />
          <Button type="submit" size="lg">
            Trazar mi constelación
          </Button>
        </div>
      </form>
    </section>
  );
}
