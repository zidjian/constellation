import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AssessmentModule } from '../assessment/assessment.module';
import { CatalogModule } from '../catalog/catalog.module';
import { GeneratePathUseCase } from './application/generate-path.use-case';
import { ManagePathsUseCases } from './application/manage-paths.use-cases';
import { LEARNING_PATH_REPOSITORY, RATIONALE_WRITER } from './domain/ports';
import { RulesRationaleWriter } from './infrastructure/rules-rationale-writer';
import { TypeOrmLearningPathRepository } from './infrastructure/typeorm-learning-path.repository';
import {
  GENERATE_LIMIT,
  PathsController,
} from './presentation/paths.controller';
import { UserThrottlerGuard } from './presentation/user-throttler.guard';

@Module({
  imports: [
    CatalogModule,
    AssessmentModule,
    // En memoria: una sola instancia (ADR-0003). Solo se aplica donde se usa UserThrottlerGuard.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'generate', ...GENERATE_LIMIT }],
    }),
  ],
  controllers: [PathsController],
  providers: [
    GeneratePathUseCase,
    ManagePathsUseCases,
    UserThrottlerGuard,
    {
      provide: LEARNING_PATH_REPOSITORY,
      useClass: TypeOrmLearningPathRepository,
    },
    // F3b: adaptador Claude con fallback a este.
    { provide: RATIONALE_WRITER, useClass: RulesRationaleWriter },
  ],
})
export class LearningPathModule {}
