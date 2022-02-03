import { MigrationInterface, QueryRunner } from "@nest-boot/database";

export class InitMigration implements MigrationInterface {
  name = "init-1643900056126";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* SQL */ `
      CREATE TABLE "personal_access_token" (
        "id" bigint NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "token" character varying(64) NOT NULL,
        "entity" character varying NOT NULL,
        "entity_id" character varying NOT NULL,
        CONSTRAINT "UQ_6bea53a3ebc17e91ccc4526c6f8" UNIQUE ("token"),
        CONSTRAINT "PK_4f29b258be0b657a3f81b75f0b7" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(/* SQL */ `
      CREATE TABLE "user" (
        "id" bigint NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "permissions" text NOT NULL,
        "name" character varying NOT NULL,
        "email" character varying NOT NULL,
        "password" character varying NOT NULL,
        CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"),
        CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(/* SQL */ `
      CREATE TABLE "post" (
        "id" bigint NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "tenant_id" bigint NOT NULL DEFAULT get_tenant_id(),
        "title" character varying NOT NULL,
        "html" text NOT NULL,
        "markdown" text NOT NULL,
        "author_id" bigint,
        CONSTRAINT "PK_be5fda3aac270b134ff9c21cdee" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(/* SQL */ `
      CREATE TABLE "blog" (
        "id" bigint NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "name" character varying NOT NULL,
        CONSTRAINT "PK_85c6532ad065a448e9de7638571" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(/* SQL */ `
      ALTER TABLE
        "post"
      ADD
        CONSTRAINT "FK_2f1a9ca8908fc8168bc18437f62" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE NO ACTION ON
      UPDATE
        NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* SQL */ `
      ALTER TABLE
        "post" DROP CONSTRAINT "FK_2f1a9ca8908fc8168bc18437f62"
    `);

    await queryRunner.query(/* SQL */ `
      DROP TABLE "blog"
    `);

    await queryRunner.query(/* SQL */ `
      DROP TABLE "post"
    `);

    await queryRunner.query(/* SQL */ `
      DROP TABLE "user"
    `);

    await queryRunner.query(/* SQL */ `
      DROP TABLE "personal_access_token"
    `);
  }
}
