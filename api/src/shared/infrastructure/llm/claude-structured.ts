import Anthropic from '@anthropic-ai/sdk';
import { Inject, Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';

export class LlmOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmOutputError';
  }
}

export interface StructuredRequest<T> {
  system: string;
  user: string;
  /** JSON Schema que restringe la salida (structured outputs). */
  jsonSchema: Record<string, unknown>;
  /** Validación posterior: la salida del modelo es un dato, no se confía en ella sin validar. */
  schema: z.ZodType<T>;
  maxTokens: number;
  signal: AbortSignal;
}

/**
 * Llamada única a Claude con salida JSON estructurada. Sin reintentos: el presupuesto es el timeout
 * del fallback (ADR-0001); si falla, el llamador usa reglas.
 */
@Injectable()
export class ClaudeStructured {
  private client: Anthropic | null = null;

  constructor(@Inject(ENV) private readonly env: Env) {}

  // Perezoso: con LLM_PROVIDER=rules no hay clave y el cliente nunca se crea.
  private get anthropic(): Anthropic {
    this.client ??= new Anthropic({
      apiKey: this.env.ANTHROPIC_API_KEY,
      maxRetries: 0,
    });
    return this.client;
  }

  async complete<T>(req: StructuredRequest<T>): Promise<T> {
    const response = await this.anthropic.beta.messages.create(
      {
        model: this.env.ANTHROPIC_MODEL,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: [{ role: 'user', content: req.user }],
        // Tarea acotada y sensible a latencia: esfuerzo bajo (el pensamiento adaptativo sigue activo).
        output_config: {
          effort: 'low',
          format: { type: 'json_schema', schema: req.jsonSchema },
        },
        // Si un clasificador de seguridad rechaza, el servidor reintenta con el modelo recomendado.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      },
      { signal: req.signal, timeout: this.env.LLM_TIMEOUT_MS },
    );

    if (response.stop_reason === 'refusal')
      throw new LlmOutputError('El modelo rechazó la petición');
    if (response.stop_reason === 'max_tokens')
      throw new LlmOutputError('Salida truncada por max_tokens');

    const text = response.content
      .flatMap((b) => (b.type === 'text' ? [b.text] : []))
      .join('');
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new LlmOutputError('La salida no es JSON válido');
    }
    const parsed = req.schema.safeParse(json);
    if (!parsed.success)
      throw new LlmOutputError(
        `Salida fuera de esquema: ${parsed.error.issues[0]?.message ?? ''}`,
      );
    return parsed.data;
  }
}
