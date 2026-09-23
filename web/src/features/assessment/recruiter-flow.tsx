"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { highlight } from "sugar-high";
import { Button } from "@/components/ui/button";
import { GenerationView } from "@/features/paths/generation-view";
import { ApiError } from "@/lib/api";
import { completeAssessment, replyRecruiter, startRecruiter } from "./api";
import { Summary } from "./summary";
import type { AssessmentSession, InterviewReport, RecruiterChallenge, RecruiterTurn, SkillProfile } from "./types";

type Message = { from: "recruiter" | "you"; text: string };

type Phase =
  | { kind: "offer" }
  | { kind: "chat"; session: AssessmentSession; challenge: RecruiterChallenge | null; finished: boolean }
  | { kind: "report"; session: AssessmentSession; profile: SkillProfile; report: InterviewReport | null }
  | { kind: "generating"; sessionId: string; name: string };

const ease = [0.22, 1, 0.36, 1] as const;

export function RecruiterFlow({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: "offer" });
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const receive = (turn: RecruiterTurn) => {
    setMessages((m) => [...m, { from: "recruiter", text: turn.say }]);
    setPhase({ kind: "chat", session: turn.session, challenge: turn.challenge, finished: turn.finished });
  };

  const start = (jobOffer: string) =>
    run(async () => {
      setMessages([]);
      receive(await startRecruiter(jobOffer));
    });

  const send = (session: AssessmentSession, text: string) =>
    run(async () => {
      setMessages((m) => [...m, { from: "you", text }]);
      receive(await replyRecruiter(session.id, { text }));
    });

  const answerChallenge = (session: AssessmentSession, challenge: RecruiterChallenge, optionId: string) =>
    run(async () => {
      // La tarjeta del reto desaparece al responder: queda en la conversación qué se preguntó y qué se eligió.
      const label = challenge.options.find((o) => o.id === optionId)?.label ?? optionId;
      setMessages((m) => [
        ...m,
        { from: "recruiter", text: `Mini-reto · ${challenge.prompt}` },
        { from: "you", text: label },
      ]);
      receive(await replyRecruiter(session.id, { optionId }));
    });

  const finish = (session: AssessmentSession) =>
    run(async () => {
      const { profile, report, session: done } = await completeAssessment(session.id);
      setPhase({ kind: "report", session: done, profile, report: report ?? null });
    });

  if (phase.kind === "generating") return <GenerationView assessmentId={phase.sessionId} name={phase.name} />;

  if (phase.kind === "report") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-10">
        {phase.report ? <Report report={phase.report} /> : <NoReport />}
        <Summary
          profile={phase.profile}
          onGenerate={(name) => setPhase({ kind: "generating", sessionId: phase.session.id, name })}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {phase.kind === "offer" ? (
        <OfferForm pending={pending} onStart={start} onBack={onBack} />
      ) : (
        <>
          <Transcript messages={messages} pending={pending} />
          {phase.finished ? (
            <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-ink-muted">La entrevista terminó. Te preparamos la devolución.</span>
              <Button onClick={() => finish(phase.session)} loading={pending} autoFocus>
                Ver mi informe
              </Button>
            </div>
          ) : phase.challenge ? (
            <ChallengeCard
              challenge={phase.challenge}
              pending={pending}
              onSubmit={(optionId) => answerChallenge(phase.session, phase.challenge!, optionId)}
            />
          ) : (
            <ReplyBox pending={pending} onSend={(text) => send(phase.session, text)} />
          )}
        </>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function OfferForm({
  pending,
  onStart,
  onBack,
}: {
  pending: boolean;
  onStart: (offer: string) => void;
  onBack: () => void;
}) {
  const [offer, setOffer] = useState("");
  const id = useId();
  const valid = offer.trim().length >= 10;
  return (
    <form
      className="flex flex-col gap-5 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onStart(offer.trim());
      }}
    >
      <h1 className="text-3xl font-semibold sm:text-4xl">Simulacro de entrevista</h1>
      <p className="max-w-[62ch] text-lg leading-relaxed text-ink-muted">
        Un reclutador técnico te entrevista sobre el puesto al que apuntas: repregunta, te pide ejemplos y te lanza algún
        mini-reto de código. Al final recibes una devolución honesta y tu ruta de estudio.
      </p>
      <label htmlFor={id} className="font-medium">
        ¿A qué puesto aspiras? Pega la oferta si la tienes.
      </label>
      <textarea
        id={id}
        autoFocus
        rows={6}
        maxLength={4000}
        value={offer}
        onChange={(e) => setOffer(e.target.value)}
        placeholder="Ej.: Backend semi senior — NestJS, PostgreSQL, Docker y pruebas automatizadas. Remoto LATAM."
        className="w-full resize-y rounded-md border border-line-strong bg-bg px-4 py-3 text-base leading-relaxed placeholder:text-ink-muted focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>
          Prefiero la entrevista guiada
        </Button>
        <Button type="submit" size="lg" disabled={!valid} loading={pending}>
          Entrar a la entrevista
        </Button>
      </div>
    </form>
  );
}

/** La conversación completa: se desplaza al último turno como en un chat real. */
const MAX_EXCHANGES = 12;

function Transcript({ messages, pending }: { messages: Message[]; pending: boolean }) {
  // El contador es de la conversación, no de `answeredCount`: en el simulacro esa cuenta incluye
  // lo que el reclutador dedujo, no solo lo que preguntó.
  const exchanges = messages.filter((m) => m.from === "recruiter").length;
  const end = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
  }, [messages.length, pending, reduce]);

  return (
    <section aria-label="Conversación con el reclutador" className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-4 border-b border-line pb-3">
        <span className="flex items-center gap-2.5 text-sm font-medium">
          <span aria-hidden className="grid size-8 place-items-center rounded-full bg-accent-soft text-accent">RT</span>
          Reclutador técnico
        </span>
        <span className="text-sm text-ink-muted tabular-nums">
          {Math.min(exchanges, MAX_EXCHANGES)} / {MAX_EXCHANGES} preguntas
        </span>
      </header>

      <ol className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.li
              key={`${i}-${m.from}`}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease }}
              className={m.from === "you" ? "flex justify-end" : "flex justify-start"}
            >
              <p
                className={
                  "max-w-[85%] rounded-lg px-4 py-3 leading-relaxed " +
                  (m.from === "you" ? "bg-primary-soft text-ink" : "bg-surface text-ink")
                }
              >
                {m.text}
              </p>
            </motion.li>
          ))}
        </AnimatePresence>
        {pending && (
          <li aria-live="polite" className="flex justify-start">
            <span className="flex items-center gap-1.5 rounded-lg bg-surface px-4 py-3.5">
              <span className="sr-only">El reclutador está escribiendo</span>
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  aria-hidden
                  className="size-2 rounded-full bg-ink-muted"
                  animate={reduce ? { opacity: 0.6 } : { opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </span>
          </li>
        )}
      </ol>
      <div ref={end} />
    </section>
  );
}

function ReplyBox({ pending, onSend }: { pending: boolean; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const id = useId();
  const valid = text.trim().length >= 2;
  const submit = () => {
    if (!valid || pending) return;
    onSend(text.trim());
    setText("");
  };
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label htmlFor={id} className="sr-only">
        Tu respuesta
      </label>
      <textarea
        id={id}
        autoFocus
        rows={3}
        maxLength={4000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Responde como lo harías en la entrevista real…"
        className="w-full resize-y rounded-md border border-line-strong bg-bg px-4 py-3 leading-relaxed placeholder:text-ink-muted focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink-muted">Enter envía · Shift+Enter salta de línea</span>
        <Button type="submit" disabled={!valid} loading={pending}>
          Responder
        </Button>
      </div>
    </form>
  );
}

function ChallengeCard({
  challenge,
  pending,
  onSubmit,
}: {
  challenge: RecruiterChallenge;
  pending: boolean;
  onSubmit: (optionId: string) => void;
}) {
  const [value, setValue] = useState<string | null>(null);
  const dots = "●".repeat(challenge.difficulty) + "○".repeat(3 - challenge.difficulty);
  return (
    <form
      className="flex flex-col gap-5 rounded-lg border border-accent/40 bg-accent-soft/40 px-5 py-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (value) onSubmit(value);
      }}
    >
      <p className="flex items-center gap-2 text-sm font-medium text-ink-muted">
        <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-accent">Mini-reto en vivo</span>
        <span aria-label={`Dificultad ${challenge.difficulty} de 3`}>{dots}</span>
      </p>
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 text-lg font-semibold">{challenge.prompt}</legend>
        {challenge.code && (
          <pre className="code overflow-x-auto rounded-md border border-line bg-bg px-4 py-3.5 font-mono text-[0.9rem] leading-relaxed">
            {/* Código curado del banco de retos (no es input del usuario). */}
            <code dangerouslySetInnerHTML={{ __html: highlight(challenge.code) }} />
          </pre>
        )}
        <div className="grid gap-2.5 sm:grid-cols-2">
          {challenge.options.map((o, i) => (
            <label
              key={o.id}
              className={
                "flex cursor-pointer items-start gap-3 rounded-md border border-line bg-bg px-4 py-3 " +
                "transition-[border-color,background-color,box-shadow] duration-150 ease-out-quint hover:border-line-strong " +
                "has-[:checked]:border-accent has-[:checked]:shadow-[inset_0_0_0_1px_var(--color-accent)] " +
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
              }
            >
              <input
                type="radio"
                name={challenge.id}
                value={o.id}
                autoFocus={i === 0}
                checked={value === o.id}
                onChange={() => setValue(o.id)}
                className="mt-1 size-4 accent-[var(--color-accent)]"
              />
              <span className={challenge.code ? "font-mono text-[0.9375rem]" : ""}>{o.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="submit" disabled={!value} loading={pending} className="self-end">
        Responder
      </Button>
    </form>
  );
}

function Report({ report }: { report: InterviewReport }) {
  return (
    <section className="flex flex-col gap-7">
      <div>
        <h1 className="text-3xl font-semibold">Tu devolución</h1>
        <p className="mt-3 max-w-[65ch] leading-relaxed text-ink-muted">{report.summary}</p>
      </div>

      {report.strengths.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-ink-muted">Lo que mostraste bien</h2>
          <ul className="flex flex-col gap-3">
            {report.strengths.map((s) => (
              <li key={s.title} className="rounded-md bg-primary-soft px-4 py-3.5">
                <p className="font-medium text-primary-strong">{s.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">«{s.quote}»</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.gaps.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-ink-muted">Lo que se esperaba escuchar</h2>
          <ul className="flex flex-col gap-3">
            {report.gaps.map((g) => (
              <li key={g.title} className="rounded-md border border-line bg-surface px-4 py-3.5">
                <p className="font-medium">{g.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{g.note}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function NoReport() {
  return (
    <section>
      <h1 className="text-3xl font-semibold">Terminaste la entrevista</h1>
      <p className="mt-3 max-w-[62ch] leading-relaxed text-ink-muted">
        No pudimos redactar la devolución esta vez, pero tus respuestas sí quedaron medidas: la ruta de abajo sale de
        ellas.
      </p>
    </section>
  );
}
