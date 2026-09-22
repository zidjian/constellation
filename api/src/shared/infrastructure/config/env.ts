import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { z } from 'zod';

// Cada feature añade aquí sus variables al llegar (LLM en F3b).
const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    WEB_ORIGIN: z.url(),
    // Vacío en local: la cookie queda host-only. En producción: .constellation.waldirmaidana.com
    COOKIE_DOMAIN: z
      .string()
      .optional()
      .transform((v) => v || undefined),
    // identity (ADR-0002)
    JWT_SECRET: z
      .string()
      .min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
    DISCORD_CLIENT_ID: z.string().min(1),
    DISCORD_CLIENT_SECRET: z.string().min(1),
    DISCORD_CALLBACK_URL: z.url(),
    // learning-path: pausa entre eventos del stream para que la constelación se dibuje paso a paso.
    PATH_STREAM_DELAY_MS: z.coerce.number().int().min(0).max(2000).default(150),
  })
  .refine(
    (env) =>
      env.NODE_ENV !== 'production' ||
      !env.JWT_SECRET.startsWith('cambia-esto'),
    {
      path: ['JWT_SECRET'],
      message:
        'JWT_SECRET de ejemplo en producción: genera uno con openssl rand -hex 32',
    },
  );

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${issues}`);
  }
  return parsed.data;
}

// Carga .env del directorio actual si existe; nunca sobrescribe variables ya definidas.
// parseEnv + asignación (en vez de process.loadEnvFile) para que también funcione bajo Jest.
export function loadDotEnv(path = '.env'): void {
  if (!existsSync(path)) return;
  for (const [key, value] of Object.entries(
    parseEnv(readFileSync(path, 'utf8')),
  )) {
    process.env[key] ??= value;
  }
}
