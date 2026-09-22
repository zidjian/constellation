import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLearningPaths1790048473926 implements MigrationInterface {
  name = 'CreateLearningPaths1790048473926';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "learning_paths" (
                "id" uuid NOT NULL,
                "user_id" uuid NOT NULL,
                "session_id" uuid,
                "name" character varying(80) NOT NULL,
                "goal" text NOT NULL,
                "status" character varying(10) NOT NULL,
                "generated_by" character varying(10) NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "learning_paths_generated_by_check" CHECK (generated_by IN ('rules', 'claude')),
                CONSTRAINT "learning_paths_status_check" CHECK (status IN ('active', 'archived')),
                CONSTRAINT "PK_2f073530d2af4a865296c06274c" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "ix_learning_paths_user_status" ON "learning_paths" ("user_id", "status")
        `);
    await queryRunner.query(`
            CREATE TABLE "path_steps" (
                "id" uuid NOT NULL,
                "path_id" uuid NOT NULL,
                "course_id" uuid NOT NULL,
                "position" smallint NOT NULL,
                "rationale" text NOT NULL,
                "completed_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "uq_path_steps_position" UNIQUE ("path_id", "position"),
                CONSTRAINT "uq_path_steps_course" UNIQUE ("path_id", "course_id"),
                CONSTRAINT "PK_7b6c422e952e0e272a3940122f7" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "learning_paths"
            ADD CONSTRAINT "FK_12027eb3d189f9a9fc20d0028ef" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "learning_paths"
            ADD CONSTRAINT "FK_e122e9acd37f66bfcf5ef097161" FOREIGN KEY ("session_id") REFERENCES "assessment_sessions"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "path_steps"
            ADD CONSTRAINT "FK_710d8ec86e95a853e6785438cd3" FOREIGN KEY ("path_id") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "path_steps"
            ADD CONSTRAINT "FK_146238c080ca5878dbc2d55b1cf" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "path_steps" DROP CONSTRAINT "FK_146238c080ca5878dbc2d55b1cf"
        `);
    await queryRunner.query(`
            ALTER TABLE "path_steps" DROP CONSTRAINT "FK_710d8ec86e95a853e6785438cd3"
        `);
    await queryRunner.query(`
            ALTER TABLE "learning_paths" DROP CONSTRAINT "FK_e122e9acd37f66bfcf5ef097161"
        `);
    await queryRunner.query(`
            ALTER TABLE "learning_paths" DROP CONSTRAINT "FK_12027eb3d189f9a9fc20d0028ef"
        `);
    await queryRunner.query(`
            DROP TABLE "path_steps"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."ix_learning_paths_user_status"
        `);
    await queryRunner.query(`
            DROP TABLE "learning_paths"
        `);
  }
}
