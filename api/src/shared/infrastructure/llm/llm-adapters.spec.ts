import { Logger } from '@nestjs/common';
import { z } from 'zod';
import type { InterpreterInput } from '../../../assessment/domain/ports';
import {
  ClaudeSkillInterpreter,
  mergeProfiles,
} from '../../../assessment/infrastructure/claude-skill-interpreter';
import { RulesSkillInterpreter } from '../../../assessment/infrastructure/rules-skill-interpreter';
import type { Course } from '../../../catalog/domain/catalog';
import type { RationaleRequest } from '../../../learning-path/domain/ports';
import { ClaudeRationaleWriter } from '../../../learning-path/infrastructure/claude-rationale-writer';
import { RulesRationaleWriter } from '../../../learning-path/infrastructure/rules-rationale-writer';
import { type Env, loadEnv } from '../config/env';
import { ClaudeStructured, LlmOutputError } from './claude-structured';
import { withFallback } from './with-fallback';

const env: Env = {
  ...loadEnv({
    DATABASE_URL: 'postgres://u:p@localhost:5432/db',
    WEB_ORIGIN: 'http://localhost:3000',
    JWT_SECRET: 'x'.repeat(32),
    DISCORD_CLIENT_ID: 'id',
    DISCORD_CLIENT_SECRET: 's',
    DISCORD_CALLBACK_URL: 'http://localhost:3001/cb',
    LLM_PROVIDER: 'claude',
    ANTHROPIC_API_KEY: 'sk-test',
  }),
  LLM_TIMEOUT_MS: 1000,
};
const silent = new Logger('test');
jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

const fakeClaude = (impl: (req: { user: string }) => Promise<unknown>) => {
  const complete = jest.fn(impl);
  return { claude: { complete } as unknown as ClaudeStructured, complete };
};

const knownSkills = [
  'javascript',
  'typescript',
  'nestjs',
  'docker',
  'sql',
  'java',
  'kubernetes',
].map((slug) => ({
  slug,
  name: slug.toUpperCase(),
}));
const input: InterpreterInput = {
  goal: 'Oferta: backend con NestJS, Docker, PostgreSQL. Llevo 3 años con Java.',
  area: 'backend',
  stackTargets: ['nestjs'],
  selfLevels: { javascript: 3 },
  challenges: [{ skill: 'javascript', difficulty: 2, correct: false }],
  knownSkills,
};

describe('withFallback', () => {
  it('devuelve claude si responde a tiempo', async () => {
    await expect(
      withFallback(
        't',
        500,
        () => Promise.resolve(1),
        () => Promise.resolve(2),
        silent,
      ),
    ).resolves.toEqual({
      value: 1,
      by: 'claude',
    });
  });

  it('cae a reglas ante error o timeout, sin rechazar nunca', async () => {
    await expect(
      withFallback(
        't',
        500,
        () => Promise.reject(new Error('503')),
        () => Promise.resolve(2),
        silent,
      ),
    ).resolves.toEqual({ value: 2, by: 'rules' });
    const hang = (signal: AbortSignal) =>
      new Promise<number>((_, reject) =>
        signal.addEventListener('abort', () => reject(new Error('abortado'))),
      );
    const started = Date.now();
    await expect(
      withFallback('t', 80, hang, () => Promise.resolve(2), silent),
    ).resolves.toEqual({ value: 2, by: 'rules' });
    expect(Date.now() - started).toBeLessThan(500);
  });
});

describe('ClaudeSkillInterpreter', () => {
  const rules = new RulesSkillInterpreter();

  it('lo medido manda: Claude solo añade objetivos y niveles de skills no medidas', async () => {
    const { claude } = fakeClaude(() =>
      Promise.resolve({
        targetSkills: ['docker', 'sql', 'javascript', 'cobol'],
        inferredLevels: [
          { skill: 'java', level: 3 },
          { skill: 'javascript', level: 3 }, // medido por reto: no se pisa
          { skill: 'cobol', level: 2 },
        ],
      }),
    );
    const { profile, by } = await new ClaudeSkillInterpreter(
      claude,
      rules,
      env,
    ).interpret(input);
    expect(by).toBe('claude');
    expect(profile.levels.javascript).toBe(1); // falló el reto de nivel 2
    expect(profile.levels.java).toBe(3);
    expect(profile.levels).not.toHaveProperty('cobol');
    expect(profile.targetSkills).toEqual([
      'nestjs',
      'docker',
      'sql',
      'javascript',
    ]); // stack primero; sin cobol; JS quedó en 1
  });

  it('pasa el texto del usuario delimitado, como dato', async () => {
    const { claude, complete } = fakeClaude(() =>
      Promise.resolve({ targetSkills: [], inferredLevels: [] }),
    );
    await new ClaudeSkillInterpreter(claude, rules, env).interpret(input);
    const user = (complete.mock.calls[0] as [{ user: string }])[0].user;
    expect(user).toContain(`<objetivo>\n${input.goal}\n</objetivo>`);
  });

  it('si Claude falla, el perfil es exactamente el de reglas', async () => {
    const { claude } = fakeClaude(() =>
      Promise.reject(new LlmOutputError('Salida fuera de esquema')),
    );
    const result = await new ClaudeSkillInterpreter(
      claude,
      rules,
      env,
    ).interpret(input);
    expect(result).toEqual({ profile: rules.profile(input), by: 'rules' });
  });

  it('sin texto libre no llama a Claude', async () => {
    const { claude, complete } = fakeClaude(() =>
      Promise.resolve({ targetSkills: [], inferredLevels: [] }),
    );
    const result = await new ClaudeSkillInterpreter(
      claude,
      rules,
      env,
    ).interpret({ ...input, goal: '  ' });
    expect(complete).not.toHaveBeenCalled();
    expect(result.by).toBe('rules');
  });

  it('mergeProfiles no propone como objetivo algo que ya domina', () => {
    const merged = mergeProfiles(
      { levels: { docker: 2 }, targetSkills: [] },
      { targetSkills: ['docker', 'sql'], inferredLevels: [] },
      new Set(['docker', 'sql']),
      [],
    );
    expect(merged.targetSkills).toEqual(['sql']);
  });
});

describe('ClaudeRationaleWriter', () => {
  const course = (slug: string): Course => ({
    slug,
    title: slug.toUpperCase(),
    url: '',
    imageUrl: '',
    summary: '',
    level: 'beginner',
    durationHours: 10,
    teaches: [slug],
    requires: [],
    prerequisites: [],
  });
  const request: RationaleRequest = {
    profile: { levels: {}, targetSkills: ['nestjs'], goal: 'backend' },
    skillNames: {},
    steps: [
      {
        position: 0,
        course: course('ts'),
        reason: { kind: 'prerequisite', for: ['nestjs'] },
        dependents: [course('nestjs')],
      },
      {
        position: 1,
        course: course('nestjs'),
        reason: { kind: 'target', skills: ['nestjs'] },
        dependents: [],
      },
    ],
  };
  const rules = new RulesRationaleWriter();

  it('usa los textos de Claude en el orden de los pasos', async () => {
    const { claude } = fakeClaude(() =>
      Promise.resolve({
        rationales: [
          { position: 1, text: 'Nest es tu objetivo directo para backend.' },
          { position: 0, text: 'TypeScript es la base que Nest necesita.' },
        ],
      }),
    );
    await expect(
      new ClaudeRationaleWriter(claude, rules, env).write(request),
    ).resolves.toEqual({
      texts: [
        'TypeScript es la base que Nest necesita.',
        'Nest es tu objetivo directo para backend.',
      ],
      by: 'claude',
    });
  });

  it('si falta una posición (o sobra), todo se redacta por reglas', async () => {
    const { claude } = fakeClaude(() =>
      Promise.resolve({
        rationales: [{ position: 0, text: 'Solo uno de los dos pasos.' }],
      }),
    );
    await expect(
      new ClaudeRationaleWriter(claude, rules, env).write(request),
    ).resolves.toEqual({
      texts: rules.texts(request),
      by: 'rules',
    });
  });
});

describe('ClaudeStructured', () => {
  const withResponse = (response: object) => {
    const service = new ClaudeStructured(env);
    const create = jest.fn().mockResolvedValue(response);
    (service as unknown as { client: unknown }).client = {
      beta: { messages: { create } },
    };
    return { service, create };
  };
  const req = {
    system: 's',
    user: 'u',
    jsonSchema: { type: 'object' },
    schema: z.object({ ok: z.boolean() }),
    maxTokens: 100,
    signal: new AbortController().signal,
  };

  it('pide salida estructurada con fallbacks y sin reintentos, y valida el JSON', async () => {
    const { service, create } = withResponse({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{"ok":true}' }],
    });
    await expect(service.complete(req)).resolves.toEqual({ ok: true });
    const [body, options] = create.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(body).toMatchObject({
      model: 'claude-opus-5',
      fallbacks: 'default',
      betas: ['server-side-fallback-2026-07-01'],
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: { type: 'object' } },
      },
    });
    expect(options).toMatchObject({ timeout: env.LLM_TIMEOUT_MS });
  });

  it.each([
    ['rechazo', { stop_reason: 'refusal', content: [] }, /rechazó/],
    [
      'truncado',
      {
        stop_reason: 'max_tokens',
        content: [{ type: 'text', text: '{"ok":' }],
      },
      /truncada/,
    ],
    [
      'JSON inválido',
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'hola' }] },
      /JSON/,
    ],
    [
      'fuera de esquema',
      {
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: '{"ok":"sí"}' }],
      },
      /esquema/,
    ],
  ])('lanza LlmOutputError si hay %s', async (_, response, msg) => {
    await expect(withResponse(response).service.complete(req)).rejects.toThrow(
      msg,
    );
  });
});
