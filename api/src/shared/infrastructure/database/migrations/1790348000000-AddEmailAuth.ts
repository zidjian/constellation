import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Alta con correo y contraseña, además del login con Discord.
 * `discord_id` pasa a ser opcional y un CHECK garantiza que toda cuenta tenga al menos una forma
 * de entrar. Los tokens de recuperación se guardan **hasheados**: la base no sirve para entrar.
 */
export class AddEmailAuth1790348000000 implements MigrationInterface {
  name = 'AddEmailAuth1790348000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "users"
            ALTER COLUMN "discord_id" DROP NOT NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "users"
            ADD "email" character varying(320)
        `);
    await queryRunner.query(`
            ALTER TABLE "users"
            ADD "password_hash" character varying(255)
        `);
    // El correo se guarda normalizado en minúsculas; el índice único lo hace inequívoco.
    await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email")
        `);
    await queryRunner.query(`
            ALTER TABLE "users"
            ADD CONSTRAINT "users_login_method_check"
            CHECK ("discord_id" IS NOT NULL OR ("email" IS NOT NULL AND "password_hash" IS NOT NULL))
        `);

    await queryRunner.query(`
            CREATE TABLE "password_reset_tokens" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "user_id" uuid NOT NULL,
                "token_hash" character varying(64) NOT NULL,
                "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "used_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_password_reset_tokens" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_password_reset_tokens_hash" UNIQUE ("token_hash")
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "password_reset_tokens"
            ADD CONSTRAINT "FK_password_reset_tokens_user" FOREIGN KEY ("user_id")
            REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_password_reset_tokens_user" ON "password_reset_tokens" ("user_id")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
    await queryRunner.query(`
            ALTER TABLE "users" DROP CONSTRAINT "users_login_method_check"
        `);
    await queryRunner.query(`DROP INDEX "uq_users_email"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "password_hash"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email"`);
    // Solo se puede volver atrás si no quedan cuentas sin Discord.
    await queryRunner.query(`
            DELETE FROM "users" WHERE "discord_id" IS NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "users"
            ALTER COLUMN "discord_id" SET NOT NULL
        `);
  }
}
