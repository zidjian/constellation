import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { DomainError, DomainErrorKind } from '../domain/domain-error';

const STATUS_BY_KIND: Record<DomainErrorKind, number> = {
  validation: HttpStatus.BAD_REQUEST,
  unauthenticated: HttpStatus.UNAUTHORIZED,
  not_found: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
  forbidden: HttpStatus.FORBIDDEN,
  rate_limited: HttpStatus.TOO_MANY_REQUESTS,
};

// Mensajes propios: lo que llega de Express o de Nest viene en inglés y con detalle interno.
const MESSAGE_BY_STATUS: Record<number, string> = {
  400: 'Petición inválida',
  401: 'Inicia sesión para continuar',
  403: 'No tienes acceso a esto',
  404: 'No encontramos lo que buscas',
  409: 'La operación no se puede completar en este estado',
  413: 'El contenido enviado es demasiado grande',
  429: 'Demasiadas peticiones seguidas. Espera un momento y vuelve a intentarlo.',
};

const CODE_BY_STATUS: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'RATE_LIMITED',
};

export interface ApiErrorBody {
  error: { code: string; message: string };
}

// Formato único de error: { error: { code, message } }. Nunca expone stack ni detalles internos.
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toResponse(exception);
    // Un stream SSE ya abierto no puede cambiar a JSON: lo cierra quien lo emite.
    if (res.headersSent) return;
    res.status(status).json(body);
  }

  private toResponse(exception: unknown): {
    status: number;
    body: ApiErrorBody;
  } {
    if (exception instanceof DomainError) {
      return {
        status: STATUS_BY_KIND[exception.kind],
        body: { error: { code: exception.code, message: exception.message } },
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const custom =
        typeof payload === 'object' && payload !== null && 'code' in payload
          ? (payload as { code: string; message?: string })
          : null;
      return {
        status,
        body: {
          error: {
            code: custom?.code ?? CODE_BY_STATUS[status] ?? 'HTTP_ERROR',
            message:
              custom?.message ??
              MESSAGE_BY_STATUS[status] ??
              'No pudimos completar la operación',
          },
        },
      };
    }
    // Errores 4xx de middlewares de Express (p. ej. body-parser: 413, JSON malformado) no son HttpException.
    const clientStatus = clientErrorStatus(exception);
    if (clientStatus) {
      return {
        status: clientStatus,
        body: {
          error: {
            code: CODE_BY_STATUS[clientStatus] ?? 'BAD_REQUEST',
            message: MESSAGE_BY_STATUS[clientStatus] ?? 'Petición inválida',
          },
        },
      };
    }
    this.logger.error(exception);
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error interno del servidor',
        },
      },
    };
  }
}

function clientErrorStatus(exception: unknown): number | null {
  if (typeof exception !== 'object' || exception === null) return null;
  const { status, statusCode } = exception as {
    status?: unknown;
    statusCode?: unknown;
  };
  const value = typeof status === 'number' ? status : statusCode;
  return typeof value === 'number' && value >= 400 && value < 500
    ? value
    : null;
}
