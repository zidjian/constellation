import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecruiterMode1790126166885 implements MigrationInterface {
  name = 'AddRecruiterMode1790126166885';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "interview_reports" (
                "session_id" uuid NOT NULL,
                "report" jsonb NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_6ee8080c47ff258ae56ab035d31" PRIMARY KEY ("session_id")
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "assessment_sessions"
            ADD "mode" character varying(20) NOT NULL DEFAULT 'guided'
        `);
    await queryRunner.query(`
            ALTER TABLE "assessment_sessions"
            ADD CONSTRAINT "assessment_sessions_mode_check" CHECK (mode IN ('guided', 'recruiter'))
        `);
    await queryRunner.query(`
            ALTER TABLE "interview_reports"
            ADD CONSTRAINT "FK_6ee8080c47ff258ae56ab035d31" FOREIGN KEY ("session_id") REFERENCES "assessment_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "interview_reports" DROP CONSTRAINT "FK_6ee8080c47ff258ae56ab035d31"
        `);
    await queryRunner.query(`
            ALTER TABLE "assessment_sessions" DROP CONSTRAINT "assessment_sessions_mode_check"
        `);
    await queryRunner.query(`
            ALTER TABLE "assessment_sessions" DROP COLUMN "mode"
        `);
    await queryRunner.query(`
            DROP TABLE "interview_reports"
        `);
  }
}
