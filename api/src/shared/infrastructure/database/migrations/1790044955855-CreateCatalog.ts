import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCatalog1790044955855 implements MigrationInterface {
  name = 'CreateCatalog1790044955855';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "courses" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "slug" character varying(150) NOT NULL,
                "title" character varying(255) NOT NULL,
                "url" character varying(500) NOT NULL,
                "image_url" character varying(500) NOT NULL,
                "summary" text NOT NULL,
                "level" character varying(20) NOT NULL,
                "duration_hours" numeric(5, 1) NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_a3bb2d01cfa0f95bc5e034e1b7a" UNIQUE ("slug"),
                CONSTRAINT "courses_duration_check" CHECK (duration_hours > 0),
                CONSTRAINT "courses_level_check" CHECK (
                    level IN ('beginner', 'intermediate', 'advanced')
                ),
                CONSTRAINT "PK_3f70a487cc718ad8eda4e6d58c9" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "course_prerequisites" (
                "course_id" uuid NOT NULL,
                "prerequisite_id" uuid NOT NULL,
                CONSTRAINT "course_prerequisites_not_self" CHECK (course_id <> prerequisite_id),
                CONSTRAINT "PK_706e83b86d0099af2e566fc8020" PRIMARY KEY ("course_id", "prerequisite_id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "skills" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "slug" character varying(100) NOT NULL,
                "name" character varying(150) NOT NULL,
                "area" character varying(20) NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_55b7acbf80551e7fa2b5a33ed6c" UNIQUE ("slug"),
                CONSTRAINT "skills_area_check" CHECK (
                    area IN (
                        'fundamentals',
                        'frontend',
                        'backend',
                        'mobile',
                        'devops'
                    )
                ),
                CONSTRAINT "PK_0d3212120f4ecedf90864d7e298" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "course_skills" (
                "course_id" uuid NOT NULL,
                "skill_id" uuid NOT NULL,
                "relation" character varying(10) NOT NULL,
                CONSTRAINT "course_skills_relation_check" CHECK (relation IN ('teaches', 'requires')),
                CONSTRAINT "PK_c7837a5bae3aabb6d87c33ba2d6" PRIMARY KEY ("course_id", "skill_id", "relation")
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "course_prerequisites"
            ADD CONSTRAINT "FK_2caff7cd02b6e0bb6f87a7b7ac4" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "course_prerequisites"
            ADD CONSTRAINT "FK_62edaabbf461a782f824e98a602" FOREIGN KEY ("prerequisite_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "course_skills"
            ADD CONSTRAINT "FK_03aa4e2a59bcce232d3c8c23405" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "course_skills"
            ADD CONSTRAINT "FK_458ecd9be8f7115bd3b23b12010" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "course_skills" DROP CONSTRAINT "FK_458ecd9be8f7115bd3b23b12010"
        `);
    await queryRunner.query(`
            ALTER TABLE "course_skills" DROP CONSTRAINT "FK_03aa4e2a59bcce232d3c8c23405"
        `);
    await queryRunner.query(`
            ALTER TABLE "course_prerequisites" DROP CONSTRAINT "FK_62edaabbf461a782f824e98a602"
        `);
    await queryRunner.query(`
            ALTER TABLE "course_prerequisites" DROP CONSTRAINT "FK_2caff7cd02b6e0bb6f87a7b7ac4"
        `);
    await queryRunner.query(`
            DROP TABLE "course_skills"
        `);
    await queryRunner.query(`
            DROP TABLE "skills"
        `);
    await queryRunner.query(`
            DROP TABLE "course_prerequisites"
        `);
    await queryRunner.query(`
            DROP TABLE "courses"
        `);
  }
}
