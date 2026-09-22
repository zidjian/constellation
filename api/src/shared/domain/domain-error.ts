// Error de negocio con código estable para el frontend (SCREAMING_SNAKE_CASE).
// El dominio expresa la categoría; el mapeo a HTTP vive en presentation.
export type DomainErrorKind =
  | 'validation'
  | 'unauthenticated'
  | 'not_found'
  | 'conflict'
  | 'forbidden'
  | 'rate_limited';

export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly kind: DomainErrorKind,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
