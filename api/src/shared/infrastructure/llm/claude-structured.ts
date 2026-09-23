import Anthropic from '@anthropic-ai/sdk';
import { Inject, Injectable, Logger } from '@nestjs/common';
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
  /** Turno único. Para una conversación, usa `messages`. */
  user?: string;
  /** Historial completo; el prefijo estable se marca como cacheable. */
  messages?: { role: 'user' | 'assistant'; content: string }[];
  /** Modelo para esta llamada (por defecto `ANTHROPIC_MODEL`). */
  model?: string;
  /** Cachea el system y el historial previo: en conversaciones largas es lo que abarata la factura. */
  cache?: boolean;
  effort?: 'low' | 'medium' | 'high';
  /** JSON Schema que restringe la salida (structured outputs). */
  jsonSchema: Record<string, unknown>;
  /** Validación posterior: la salida del modelo es un dato, no se confía en ella sin validar. */
  schema: z.ZodType<T>;
  maxTokens: number;
  /** Tope de la petición HTTP; debe acompañar al del AbortSignal del llamador. */
  timeoutMs: number;
  signal: AbortSignal;
}

/**
 * Llamada única a Claude con salida JSON estructurada. Sin reintentos: el presupuesto es el timeout
 * del fallback (ADR-0001); si falla, el llamador usa reglas.
 */
@Injectable()
export class ClaudeStructured {
  private readonly logger = new Logger(ClaudeStructured.name);

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
        model: req.model ?? this.env.ANTHROPIC_MODEL,
        max_tokens: req.maxTokens,
        // El system es idéntico en todos los turnos: cachearlo evita pagarlo una y otra vez.
        system: req.cache
          ? [
              {
                type: 'text' as const,
                text: req.system,
                cache_control: { type: 'ephemeral' as const },
              },
            ]
          : req.system,
        messages: this.toMessages(req),
        // Tarea acotada y sensible a latencia: esfuerzo bajo (el pensamiento adaptativo sigue activo).
        output_config: {
          effort: req.effort ?? 'low',
          format: { type: 'json_schema', schema: req.jsonSchema },
        },
        // Si un clasificador de seguridad rechaza, el servidor reintenta con el modelo recomendado.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      },
      { signal: req.signal, timeout: req.timeoutMs },
    );

    this.logUsage(response.usage);
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

  /** El penúltimo mensaje se marca cacheable: el prefijo de la conversación se reutiliza por turno. */
  private toMessages(req: StructuredRequest<unknown>) {
    if (!req.messages?.length) {
      return [{ role: 'user' as const, content: req.user ?? '' }];
    }
    const cacheAt = req.messages.length - 2;
    return req.messages.map((m, i) => ({
      role: m.role,
      content:
        req.cache && i === cacheAt
          ? [
              {
                type: 'text' as const,
                text: m.content,
                cache_control: { type: 'ephemeral' as const },
              },
            ]
          : m.content,
    }));
  }

  private logUsage(usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  }): void {
    if (!usage) return;
    this.logger.debug(
      `tokens · entrada ${usage.input_tokens} · salida ${usage.output_tokens} · caché leída ${usage.cache_read_input_tokens ?? 0} · escrita ${usage.cache_creation_input_tokens ?? 0}`,
    );
  }
}
