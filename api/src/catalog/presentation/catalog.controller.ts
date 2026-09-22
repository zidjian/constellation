import { Controller, Get } from '@nestjs/common';
import { GetCatalogUseCase } from '../application/get-catalog.use-case';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly getCatalog: GetCatalogUseCase) {}

  // Exige sesión: lo aplica el guard global de identity.
  @Get('courses')
  courses() {
    return this.getCatalog.execute();
  }
}
