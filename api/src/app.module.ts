import { Module } from '@nestjs/common';
import { CatalogModule } from './catalog/catalog.module';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { ConfigModule } from './shared/infrastructure/config/config.module';
import { DatabaseModule } from './shared/infrastructure/database/database.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    HealthModule,
    IdentityModule,
    CatalogModule,
  ],
})
export class AppModule {}
