import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AssessmentModule } from './assessment/assessment.module';
import { CatalogModule } from './catalog/catalog.module';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { LearningPathModule } from './learning-path/learning-path.module';
import { ConfigModule } from './shared/infrastructure/config/config.module';
import { DatabaseModule } from './shared/infrastructure/database/database.module';
import { LlmModule } from './shared/infrastructure/llm/llm.module';
import { RATE_LIMITS } from './shared/presentation/user-throttler.guard';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    LlmModule,
    // Contadores en memoria: una sola instancia (ADR-0003). Se aplican donde se usa UserThrottlerGuard.
    ThrottlerModule.forRoot({ throttlers: Object.values(RATE_LIMITS) }),
    HealthModule,
    IdentityModule,
    CatalogModule,
    AssessmentModule,
    LearningPathModule,
  ],
})
export class AppModule {}
