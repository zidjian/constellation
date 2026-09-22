import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';
/** Excluye una ruta del guard global de sesión. Todo lo demás exige sesión por defecto. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
