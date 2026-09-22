import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ApiExceptionFilter } from './api-exception.filter';
import { DataEnvelopeInterceptor } from './data-envelope.interceptor';

// Configuración HTTP compartida por main.ts y los tests e2e.
export function configureApp(
  app: INestApplication,
  options: { webOrigin: string },
): void {
  // Detrás de Nginx: necesario para cookies Secure y rate limit por IP.
  (app as NestExpressApplication).set('trust proxy', 1);
  app.setGlobalPrefix('v1');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: options.webOrigin, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: errors
            .flatMap((e) => Object.values(e.constraints ?? {}))
            .join('; '),
        }),
    }),
  );
  app.useGlobalInterceptors(new DataEnvelopeInterceptor());
  app.useGlobalFilters(new ApiExceptionFilter());
}
