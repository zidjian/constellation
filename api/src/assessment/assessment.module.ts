import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { AssessmentUseCases } from './application/assessment.use-cases';
import { RecruiterUseCases } from './application/recruiter.use-cases';
import { ASSESSMENT_REPOSITORY, SKILL_INTERPRETER } from './domain/ports';
import { ENV } from '../shared/infrastructure/config/config.module';
import type { Env } from '../shared/infrastructure/config/env';
import { ClaudeRecruiter } from './infrastructure/claude-recruiter';
import { ClaudeSkillInterpreter } from './infrastructure/claude-skill-interpreter';
import { RulesSkillInterpreter } from './infrastructure/rules-skill-interpreter';
import { TypeOrmAssessmentRepository } from './infrastructure/typeorm-assessment.repository';
import { AssessmentController } from './presentation/assessment.controller';

@Module({
  imports: [CatalogModule],
  controllers: [AssessmentController],
  providers: [
    AssessmentUseCases,
    RecruiterUseCases,
    ClaudeRecruiter,
    { provide: ASSESSMENT_REPOSITORY, useClass: TypeOrmAssessmentRepository },
    RulesSkillInterpreter,
    ClaudeSkillInterpreter,
    // LLM_PROVIDER=claude: Claude con fallback a reglas. Si no, solo reglas (ADR-0001).
    {
      provide: SKILL_INTERPRETER,
      inject: [ENV, RulesSkillInterpreter, ClaudeSkillInterpreter],
      useFactory: (
        env: Env,
        rules: RulesSkillInterpreter,
        claude: ClaudeSkillInterpreter,
      ) => (env.LLM_PROVIDER === 'claude' ? claude : rules),
    },
  ],
  exports: [ASSESSMENT_REPOSITORY],
})
export class AssessmentModule {}
