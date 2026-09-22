import { Module } from '@nestjs/common';
import { AssessmentModule } from '../assessment/assessment.module';
import { CatalogModule } from '../catalog/catalog.module';
import { GeneratePathUseCase } from './application/generate-path.use-case';
import { ManagePathsUseCases } from './application/manage-paths.use-cases';
import { LEARNING_PATH_REPOSITORY, RATIONALE_WRITER } from './domain/ports';
import { ENV } from '../shared/infrastructure/config/config.module';
import type { Env } from '../shared/infrastructure/config/env';
import { ClaudeRationaleWriter } from './infrastructure/claude-rationale-writer';
import { RulesRationaleWriter } from './infrastructure/rules-rationale-writer';
import { TypeOrmLearningPathRepository } from './infrastructure/typeorm-learning-path.repository';
import { PathsController } from './presentation/paths.controller';

@Module({
  imports: [CatalogModule, AssessmentModule],
  controllers: [PathsController],
  providers: [
    GeneratePathUseCase,
    ManagePathsUseCases,
    {
      provide: LEARNING_PATH_REPOSITORY,
      useClass: TypeOrmLearningPathRepository,
    },
    RulesRationaleWriter,
    ClaudeRationaleWriter,
    {
      provide: RATIONALE_WRITER,
      inject: [ENV, RulesRationaleWriter, ClaudeRationaleWriter],
      useFactory: (
        env: Env,
        rules: RulesRationaleWriter,
        claude: ClaudeRationaleWriter,
      ) => (env.LLM_PROVIDER === 'claude' ? claude : rules),
    },
  ],
})
export class LearningPathModule {}
