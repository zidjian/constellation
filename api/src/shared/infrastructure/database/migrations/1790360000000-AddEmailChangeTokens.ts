import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cambio de correo con verificación: el correo nuevo no entra en `users` hasta que se confirma
 * desde él. También sirve para que una cuenta de Discord añada correo (y después, contraseña).
 */
export class AddEmailChangeTokens1790360000000 implements MigrationInterface {
  name = 'AddEmailChangeTokens1790360000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "email_change_tokens" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "user_id" uuid NOT NULL,
                "new_email" character varying(320) NOT NULL,
                "token_hash" character varying(64) NOT NULL,
                "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "used_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_email_change_tokens" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_email_change_tokens_hash" UNIQUE ("token_hash")
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "email_change_tokens"
            ADD CONSTRAINT "FK_email_change_tokens_user" FOREIGN KEY ("user_id")
            REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_email_change_tokens_user" ON "email_change_tokens" ("user_id")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "email_change_tokens"`);
  }
}
