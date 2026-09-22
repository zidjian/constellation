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
  not_found: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
  forbidden: HttpStatus.FORBIDDEN,
  rate_limited: HttpStatus.TOO_MANY_REQUESTS,
};

const CODE_BY_STATUS: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
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
            message: custom?.message ?? exception.message,
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
