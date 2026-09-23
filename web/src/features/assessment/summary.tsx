"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { catalogSkills } from "./api";
import type { SkillProfile } from "./types";

/** Cierre común de los dos modos de entrevista: lo medido y el nombre de la ruta. */
export function Summary({ profile, onGenerate }: { profile: SkillProfile; onGenerate: (name: string) => void }) {
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
