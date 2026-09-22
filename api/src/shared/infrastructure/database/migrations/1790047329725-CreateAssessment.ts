import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAssessment1790047329725 implements MigrationInterface {
  name = 'CreateAssessment1790047329725';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "assessment_sessions" (
                "id" uuid NOT NULL,
                "user_id" uuid NOT NULL,
                "status" character varying(20) NOT NULL,
                "goal_text" text,
                "completed_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "assessment_sessions_status_check" CHECK (
                    status IN ('in_progress', 'completed', 'abandoned')
                ),
                CONSTRAINT "PK_bf474814c4c2937be715ab78d9e" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "ix_assessment_sessions_user" ON "assessment_sessions" ("user_id")
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_assessment_sessions_in_progress" ON "assessment_sessions" ("user_id")
            WHERE status = 'in_progress'
        `);
    await queryRunner.query(`
            CREATE TABLE "assessment_answers" (
                "session_id" uuid NOT NULL,
                "position" smallint NOT NULL,
                "question_key" character varying(64) NOT NULL,
                "answer" jsonb NOT NULL,
                "score" smallint,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "uq_assessment_answers_question" UNIQUE ("session_id", "question_key"),
                CONSTRAINT "PK_3f49867ad99895be0ecaeb001df" PRIMARY KEY ("session_id", "position")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "skill_profiles" (
                "session_id" uuid NOT NULL,
                "levels" jsonb NOT NULL,
                "target_skills" text array NOT NULL,
                "interpreted_by" character varying(10) NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "skill_profiles_interpreted_by_check" CHECK (interpreted_by IN ('claude', 'rules')),
                CONSTRAINT "PK_f1b10b83a08769073d34569b3a7" PRIMARY KEY ("session_id")
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "assessment_sessions"
            ADD CONSTRAINT "FK_e0b38797fa776894faead6de33a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "assessment_answers"
            ADD CONSTRAINT "FK_c39afac288bb15d6b428bfa23ae" FOREIGN KEY ("session_id") REFERENCES "assessment_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "skill_profiles"
            ADD CONSTRAINT "FK_f1b10b83a08769073d34569b3a7" FOREIGN KEY ("session_id") REFERENCES "assessment_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "skill_profiles" DROP CONSTRAINT "FK_f1b10b83a08769073d34569b3a7"
        `);
    await queryRunner.query(`
            ALTER TABLE "assessment_answers" DROP CONSTRAINT "FK_c39afac288bb15d6b428bfa23ae"
        `);
    await queryRunner.query(`
            ALTER TABLE "assessment_sessions" DROP CONSTRAINT "FK_e0b38797fa776894faead6de33a"
        `);
    await queryRunner.query(`
            DROP TABLE "skill_profiles"
        `);
    await queryRunner.query(`
            DROP TABLE "assessment_answers"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."uq_assessment_sessions_in_progress"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."ix_assessment_sessions_user"
        `);
    await queryRunner.query(`
            DROP TABLE "assessment_sessions"
        `);
  }
}
