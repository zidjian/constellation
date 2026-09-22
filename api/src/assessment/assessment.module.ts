import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { AssessmentUseCases } from './application/assessment.use-cases';
import { ASSESSMENT_REPOSITORY, SKILL_INTERPRETER } from './domain/ports';
import { RulesSkillInterpreter } from './infrastructure/rules-skill-interpreter';
import { TypeOrmAssessmentRepository } from './infrastructure/typeorm-assessment.repository';
import { AssessmentController } from './presentation/assessment.controller';

@Module({
  imports: [CatalogModule],
  controllers: [AssessmentController],
  providers: [
    AssessmentUseCases,
    { provide: ASSESSMENT_REPOSITORY, useClass: TypeOrmAssessmentRepository },
    // F3b: adaptador Claude con fallback a este.
    { provide: SKILL_INTERPRETER, useClass: RulesSkillInterpreter },
  ],
  exports: [ASSESSMENT_REPOSITORY],
})
export class AssessmentModule {}
