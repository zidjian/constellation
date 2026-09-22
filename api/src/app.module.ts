import { Module } from '@nestjs/common';
import { AssessmentModule } from './assessment/assessment.module';
import { CatalogModule } from './catalog/catalog.module';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { LearningPathModule } from './learning-path/learning-path.module';
import { ConfigModule } from './shared/infrastructure/config/config.module';
import { DatabaseModule } from './shared/infrastructure/database/database.module';
import { LlmModule } from './shared/infrastructure/llm/llm.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    LlmModule,
    HealthModule,
    IdentityModule,
    CatalogModule,
    AssessmentModule,
    LearningPathModule,
  ],
})
export class AppModule {}
