import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

// Formato único de éxito: { data: ... }. Los handlers devuelven el payload sin envolver.
@Injectable()
export class DataEnvelopeInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<{ data: unknown }> {
    return next.handle().pipe(map((data: unknown) => ({ data: data ?? null })));
  }
}
