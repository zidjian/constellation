import { Controller, Get } from '@nestjs/common';
import { GetCatalogUseCase } from '../application/get-catalog.use-case';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly getCatalog: GetCatalogUseCase) {}

  // Requerirá sesión en cuanto exista el guard global de identity (plan §4.2).
  @Get('courses')
  courses() {
    return this.getCatalog.execute();
  }
}
