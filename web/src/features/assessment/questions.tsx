"use client";

import { useId, useState } from "react";
import { highlight } from "sugar-high";
import { Button } from "@/components/ui/button";
import type { Answer, Question } from "./types";

interface QuestionProps<Q extends Question> {
  question: Q;
  pending: boolean;
  onSubmit: (answer: Answer) => void;
}

const optionClass =
  "flex cursor-pointer items-start gap-3 rounded-md border border-line bg-bg px-4 py-3 " +
  "transition-[border-color,background-color,box-shadow] duration-150 ease-out-quint " +
  "hover:border-line-strong hover:bg-surface " +
  "has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:shadow-[inset_0_0_0_1px_var(--color-accent)] " +
  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent";

export function TextQuestion({ question, pending, onSubmit }: QuestionProps<Extract<Question, { type: "text" }>>) {
  const [text, setText] = useState("");
  const id = useId();
  const valid = text.trim().length >= 3;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit({ text });
      }}
    >
      <label htmlFor={id} className="text-xl font-semibold sm:text-2xl">
        {question.prompt}
      </label>
      <textarea
        id={id}
        autoFocus
        rows={5}
        maxLength={4000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && valid) onSubmit({ text });
        }}
        placeholder={question.placeholder}
        className="w-full resize-y rounded-md border border-line-strong bg-bg px-4 py-3 text-base leading-relaxed placeholder:text-ink-muted focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink-muted">Si pegas una oferta, detectamos las tecnologías que pide.</span>
        <Button type="submit" disabled={!valid} loading={pending}>
          Continuar
        </Button>
      </div>
    </form>
  );
}

export function ChoiceQuestion({ question, pending, onSubmit }: QuestionProps<Extract<Question, { type: "single" }>>) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (value) onSubmit({ optionId: value });
      }}
    >
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-4 text-xl font-semibold sm:text-2xl">{question.prompt}</legend>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {question.options.map((o, i) => (
            <label key={o.id} className={optionClass}>
              <input
                type="radio"
                name={question.key}
                value={o.id}
                autoFocus={i === 0}
                checked={value === o.id}
                onChange={() => setValue(o.id)}
                className="mt-1 size-4 accent-[var(--color-accent)]"
              />
              <span>
                <span className="block font-medium">{o.label}</span>
                {o.hint && <span className="block text-sm text-ink-muted">{o.hint}</span>}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="submit" disabled={!value} loading={pending} className="self-end">
        Continuar
      </Button>
    </form>
  );
}

export function ScaleQuestion({ question, pending, onSubmit }: QuestionProps<Extract<Question, { type: "scale" }>>) {
  const [levels, setLevels] = useState<Record<string, number>>({});
  const complete = question.items.every((i) => levels[i.skill] !== undefined);
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (complete) onSubmit({ levels });
      }}
    >
      <h2 className="text-xl font-semibold sm:text-2xl">{question.prompt}</h2>
      <div className="flex flex-col divide-y divide-line rounded-md border border-line">
        {question.items.map((item, row) => (
          <fieldset key={item.skill} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
            <legend className="sr-only">{item.label}</legend>
            <span aria-hidden className="font-medium md:w-48">
              {item.label}
            </span>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {question.scale.map((label, level) => (
                <label
                  key={level}
                  className={
                    "cursor-pointer rounded-md border border-line px-2.5 py-2 text-center text-sm transition-colors duration-150 " +
                    "hover:bg-surface has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:font-medium " +
                    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
                  }
                >
                  <input
                    type="radio"
                    name={item.skill}
                    className="sr-only"
                    autoFocus={row === 0 && level === 0}
                    checked={levels[item.skill] === level}
                    onChange={() => setLevels((l) => ({ ...l, [item.skill]: level }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink-muted">
          {Object.keys(levels).length} de {question.items.length} respondidas
        </span>
        <Button type="submit" disabled={!complete} loading={pending}>
          Continuar
        </Button>
      </div>
    </form>
  );
}

export function ChallengeQuestion({
  question,
  pending,
  onSubmit,
}: QuestionProps<Extract<Question, { type: "challenge" }>>) {
  const [value, setValue] = useState<string | null>(null);
  const dots = "●".repeat(question.difficulty) + "○".repeat(3 - question.difficulty);
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (value) onSubmit({ optionId: value });
      }}
    >
      <p className="flex items-center gap-2 text-sm font-medium text-ink-muted">
        <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-accent">Mini-reto</span>
        <span aria-label={`Dificultad ${question.difficulty} de 3`}>{dots}</span>
      </p>
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-4 text-xl font-semibold sm:text-2xl">{question.prompt}</legend>
        {question.code && (
          <pre className="code overflow-x-auto rounded-md border border-line bg-surface px-4 py-3.5 font-mono text-[0.9rem] leading-relaxed">
            {/* Código curado del banco de retos (no es input del usuario). */}
            <code dangerouslySetInnerHTML={{ __html: highlight(question.code) }} />
          </pre>
        )}
        <div className="grid gap-2.5 sm:grid-cols-2">
          {question.options.map((o, i) => (
            <label key={o.id} className={optionClass}>
              <input
                type="radio"
                name={question.key}
                value={o.id}
                autoFocus={i === 0}
                checked={value === o.id}
                onChange={() => setValue(o.id)}
                className="mt-1 size-4 accent-[var(--color-accent)]"
              />
              <span className={question.code ? "font-mono text-[0.9375rem]" : ""}>{o.label}</span>
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
