import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1790045684735 implements MigrationInterface {
  name = 'CreateUsers1790045684735';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "users" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "discord_id" character varying(32) NOT NULL,
                "username" character varying(100) NOT NULL,
                "avatar_url" character varying(500),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_ecb6461da358b6d8a4f83d611a0" UNIQUE ("discord_id"),
                CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
            )
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP TABLE "users"
        `);
  }
}
