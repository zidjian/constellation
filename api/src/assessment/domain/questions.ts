import type { CatalogGraph } from '../../catalog/domain/catalog-graph';
import {
  type Challenge,
  challengesFor,
  CHALLENGES,
  SKILLS_WITH_CHALLENGES,
} from './challenge-bank';

export const MAX_QUESTIONS = 10;
export const MIN_ANSWERS_TO_COMPLETE = 5;
const MAX_SCALE_ITEMS = 6;
const MAX_CHALLENGES_PER_SKILL = 2;

// --- Tipos de pregunta y respuesta -------------------------------------------------------------

type Option = { id: string; label: string; hint?: string };

export type Question =
  | { key: 'goal'; type: 'text'; prompt: string; placeholder: string }
  | { key: 'area'; type: 'single'; prompt: string; options: Option[] }
  | { key: 'stack'; type: 'single'; prompt: string; options: Option[] }
  | {
      key: 'self';
      type: 'scale';
      prompt: string;
      items: { skill: string; label: string }[];
      scale: string[];
    }
  | {
      key: `ch:${string}`;
      type: 'challenge';
      prompt: string;
      skill: string;
      difficulty: number;
      code?: string;
      language?: string;
      options: Option[];
    };

export type Answer =
  { text: string } | { optionId: string } | { levels: Record<string, number> };

export interface RecordedAnswer {
  questionKey: string;
  answer: Answer;
  /** Solo en retos: 1 acierto, 0 fallo. */
  score: number | null;
}

// --- Contenido curado ---------------------------------------------------------------------------

export const AREAS: (Option & {
  stacks: (Option & { targets: string[] })[];
})[] = [
  {
    id: 'frontend',
    label: 'Frontend web',
    hint: 'Interfaces en el navegador',
    stacks: [
      { id: 'react', label: 'React', targets: ['react'] },
      { id: 'angular', label: 'Angular', targets: ['angular'] },
      { id: 'vue', label: 'Vue', targets: ['vue'] },
    ],
  },
  {
    id: 'backend',
    label: 'Backend',
    hint: 'APIs, bases de datos y servidores',
    stacks: [
      { id: 'node', label: 'Node.js con NestJS', targets: ['nestjs'] },
      { id: 'java', label: 'Java con Spring Boot', targets: ['spring-boot'] },
      { id: 'python', label: 'Python con FastAPI', targets: ['fastapi'] },
      { id: 'dotnet', label: '.NET', targets: ['dotnet'] },
      { id: 'go', label: 'Go', targets: ['go-backend'] },
      { id: 'php', label: 'PHP con Laravel', targets: ['laravel'] },
    ],
  },
  {
    id: 'mobile',
    label: 'Apps móviles',
    hint: 'iOS y Android',
    stacks: [
      { id: 'flutter', label: 'Flutter', targets: ['flutter'] },
      { id: 'react-native', label: 'React Native', targets: ['react-native'] },
    ],
  },
  {
    id: 'ia',
    label: 'Inteligencia artificial',
    hint: 'Construir o programar con IA',
    stacks: [
      { id: 'llm-apps', label: 'Crear apps con LLMs', targets: ['llm-apps'] },
      {
        id: 'ai-coding',
        label: 'Programar más rápido con IA',
        targets: ['ai-assisted-coding'],
      },
      {
        id: 'automation',
        label: 'Automatizar tareas con IA',
        targets: ['n8n-automation'],
      },
    ],
  },
  {
    id: 'devops',
    label: 'DevOps',
    hint: 'Contenedores y despliegue',
    stacks: [
      { id: 'docker', label: 'Docker', targets: ['docker'] },
      {
        id: 'kubernetes',
        label: 'Kubernetes y microservicios',
        targets: ['kubernetes'],
      },
    ],
  },
  {
    id: 'fundamentals',
    label: 'Empezar desde cero',
    hint: 'Aprender a programar',
    stacks: [
      { id: 'javascript', label: 'JavaScript', targets: ['javascript'] },
      { id: 'python', label: 'Python', targets: ['python'] },
      { id: 'java', label: 'Java', targets: ['java'] },
    ],
  },
];

const SCALE = ['Nunca lo usé', 'Lo básico', 'Lo uso con soltura', 'Lo domino'];

// --- Selección adaptativa -----------------------------------------------------------------------

export interface FlowContext {
  graph: CatalogGraph;
}

const answerOf = (answers: RecordedAnswer[], key: string) =>
  answers.find((a) => a.questionKey === key)?.answer;

export const areaOf = (answers: RecordedAnswer[]) => {
  const a = answerOf(answers, 'area');
  return a && 'optionId' in a
    ? AREAS.find((x) => x.id === a.optionId)
    : undefined;
};

export const stackOf = (answers: RecordedAnswer[]) => {
  const s = answerOf(answers, 'stack');
  return s && 'optionId' in s
    ? areaOf(answers)?.stacks.find((x) => x.id === s.optionId)
    : undefined;
};

/**
 * Skills a autoevaluar: lo que enseñan los cursos previos a los objetivos del stack, de lo más
 * básico a lo más avanzado. Se deriva del catálogo, así que sigue siendo coherente si este cambia.
 */
export function selfAssessmentItems(
  answers: RecordedAnswer[],
  ctx: FlowContext,
) {
  const targets = stackOf(answers)?.targets ?? [];
  const teaching = ctx.graph.catalog.courses.filter((c) =>
    c.teaches.some((s) => targets.includes(s)),
  );
  const courses = [
    ...ctx.graph.prerequisiteClosure(teaching.map((c) => c.slug)),
    ...teaching.map((c) => c.slug),
  ];
  const ordered = ctx.graph.topologicalOrder(courses);
  const skills: string[] = [];
  for (const slug of ordered) {
    for (const s of ctx.graph.course(slug)!.teaches)
      if (!skills.includes(s)) skills.push(s);
  }
  // Si el objetivo no tiene previos (p. ej. "desde cero"), se pregunta por la base igualmente.
  if (!skills.includes('programming-basics'))
    skills.unshift('programming-basics');
  const names = new Map(ctx.graph.catalog.skills.map((s) => [s.slug, s.name]));
  return skills
    .slice(0, MAX_SCALE_ITEMS)
    .map((skill) => ({ skill, label: names.get(skill) ?? skill }));
}

/** Siguiente reto: escalera por skill (sube si acierta, se detiene si falla), máx. 2 por skill. */
function nextChallenge(
  answers: RecordedAnswer[],
  ctx: FlowContext,
): Challenge | null {
  const self = answerOf(answers, 'self');
  const selfLevels = self && 'levels' in self ? self.levels : {};
  const asked = answers.filter((a) => a.questionKey.startsWith('ch:'));
  const askedById = new Map(asked.map((a) => [a.questionKey.slice(3), a]));

  const skills = selfAssessmentItems(answers, ctx)
    .map((i) => i.skill)
    .filter((s) => SKILLS_WITH_CHALLENGES.has(s));

  for (const skill of skills) {
    const ladder = challengesFor(skill);
    const done = ladder.filter((ch) => askedById.has(ch.id));
    if (done.length >= MAX_CHALLENGES_PER_SKILL) continue;
    const last = done.at(-1);
    if (last && askedById.get(last.id)!.score === 0) continue; // falló: esa skill ya está medida
    if (last?.difficulty === 3) continue;

    const start = Math.min(3, Math.max(1, selfLevels[skill] ?? 1));
    const wanted = last ? last.difficulty + 1 : start;
    const next = ladder.find(
      (ch) => ch.difficulty >= wanted && !askedById.has(ch.id),
    );
    if (next) return next;
  }
  return null;
}

export function nextQuestion(
  answers: RecordedAnswer[],
  ctx: FlowContext,
): Question | null {
  if (answers.length >= MAX_QUESTIONS) return null;
  const has = (k: string) => answers.some((a) => a.questionKey === k);

  if (!has('goal')) {
    return {
      key: 'goal',
      type: 'text',
      prompt:
        '¿Qué quieres lograr? Cuéntalo con tus palabras o pega una oferta de trabajo que te interese.',
      placeholder:
        'Ej.: quiero conseguir trabajo como backend con Node y bases de datos',
    };
  }
  if (!has('area')) {
    return {
      key: 'area',
      type: 'single',
      prompt: '¿Hacia dónde quieres ir?',
      options: AREAS.map(({ id, label, hint }) => ({ id, label, hint })),
    };
  }
  if (!has('stack')) {
    const area = areaOf(answers)!;
    return {
      key: 'stack',
      type: 'single',
      prompt: `Dentro de ${area.label.toLowerCase()}, ¿qué tecnología te atrae más?`,
      options: area.stacks.map(({ id, label }) => ({ id, label })),
    };
  }
  if (!has('self')) {
    return {
      key: 'self',
      type: 'scale',
      prompt:
        '¿Cuánto conoces de cada una? Sé honesto: después viene un mini-reto.',
      items: selfAssessmentItems(answers, { graph: ctx.graph }),
      scale: SCALE,
    };
  }
  const ch = nextChallenge(answers, ctx);
  if (!ch) return null;
  return {
    key: `ch:${ch.id}`,
    type: 'challenge',
    prompt: ch.prompt,
    skill: ch.skill,
    difficulty: ch.difficulty,
    code: ch.code,
    language: ch.language,
    options: ch.options,
  };
}

// --- Validación y puntuación --------------------------------------------------------------------

/** Valida la respuesta contra la pregunta esperada. Devuelve el motivo del rechazo o null. */
export function validateAnswer(
  question: Question,
  answer: unknown,
): string | null {
  if (typeof answer !== 'object' || answer === null)
    return 'La respuesta debe ser un objeto';
  const a = answer as Record<string, unknown>;
  switch (question.type) {
    case 'text': {
      const text = typeof a.text === 'string' ? a.text.trim() : '';
      if (text.length < 3) return 'Cuéntanos un poco más (mínimo 3 caracteres)';
      if (text.length > 4000)
        return 'El texto es demasiado largo (máximo 4000 caracteres)';
      return null;
    }
    case 'single':
    case 'challenge':
      return question.options.some((o) => o.id === a.optionId)
        ? null
        : 'Opción no válida';
    case 'scale': {
      const levels = a.levels as Record<string, unknown> | undefined;
      if (typeof levels !== 'object' || levels === null)
        return 'Faltan los niveles';
      for (const { skill } of question.items) {
        const v = levels[skill];
        if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > 3)
          return `Nivel no válido para ${skill}`;
      }
      return null;
    }
  }
}

/** Normaliza la respuesta ya validada (recorta texto, descarta claves de más). */
export function normalizeAnswer(
  question: Question,
  answer: Record<string, unknown>,
): Answer {
  switch (question.type) {
    case 'text':
      return { text: (answer.text as string).trim() };
    case 'single':
    case 'challenge':
      return { optionId: answer.optionId as string };
    case 'scale':
      return {
        levels: Object.fromEntries(
          question.items.map(({ skill }) => [
            skill,
            (answer.levels as Record<string, number>)[skill],
          ]),
        ),
      };
  }
}

/** Puntuación determinista: solo los retos puntúan. */
export function scoreAnswer(question: Question, answer: Answer): number | null {
  if (question.type !== 'challenge' || !('optionId' in answer)) return null;
  const ch = CHALLENGES.find((c) => `ch:${c.id}` === question.key)!;
  return answer.optionId === ch.correctOptionId ? 1 : 0;
}

export const challengeById = (id: string) =>
  CHALLENGES.find((c) => c.id === id);
