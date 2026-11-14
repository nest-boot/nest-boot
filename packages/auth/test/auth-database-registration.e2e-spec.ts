import { MikroORM } from "@mikro-orm/core";
import { type MikroORM as PgliteORM, PgliteDriver } from "@mikro-orm/pglite";
import { DatabaseModule } from "@nest-boot/database";
import { HashService } from "@nest-boot/hash";
import { Mailer } from "@nest-boot/mailer";
import { Global, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { ApiKey } from "../src/api-key/entities/api-key.entity.js";
import { AuthModule } from "../src/core/auth.module.js";
import { entities } from "../src/core/auth-entities.js";
import { workspaceEntities } from "../src/core/auth-entities.js";
import { User } from "../src/core/entities/user.entity.js";
import { withAuthTestFeatures } from "./fixtures/enabled-auth-features.fixture.js";

@Global()
@Module({
  providers: [
    { provide: HashService, useValue: { hash: vi.fn(), verify: vi.fn() } },
    { provide: Mailer, useValue: { sendMail: vi.fn() } },
  ],
  exports: [HashService, Mailer],
})
class AuthInfrastructureModule {}

it.each([false, true])(
  "registers every concrete auth entity without a CLI config (async: %s)",
  async (asyncOptions) => {
    const options = {
      workspace: { enabled: true },
      secret:
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_",
      baseURL: "http://localhost:3000",
      middleware: { register: false },
    };
    const factory = vi.fn(() => Promise.resolve(withAuthTestFeatures(options)));
    const app = await Test.createTestingModule({
      imports: [
        AuthInfrastructureModule,
        DatabaseModule.forRoot({
          driver: PgliteDriver,
          dbName: "memory://",
          entities: [],
        }),
        asyncOptions
          ? AuthModule.forRootAsync({ useFactory: factory })
          : AuthModule.forRoot(withAuthTestFeatures(options)),
      ],
    }).compile();
    try {
      const orm = app.get<PgliteORM>(MikroORM);
      for (const entity of [...entities, ...workspaceEntities]) {
        if (typeof entity !== "function" && entity.meta.abstract) {
          continue;
        }
        expect(
          orm
            .getMetadata()
            .has<object>(typeof entity === "function" ? entity : entity.class),
        ).toBe(true);
      }
      expect(factory).toHaveBeenCalledTimes(asyncOptions ? 1 : 0);
      await orm.em.execute("create role authenticated nologin");
      await orm.em.execute("create role anonymous nologin");
      await orm.schema.create();
      const em = orm.em.fork();
      expect(
        await em.execute("select to_regclass('base_api_key') as base"),
      ).toEqual([{ base: null }]);
      const key = orm.getMetadata(ApiKey);
      expect(key.properties.owner.polymorphic).toBe(true);
      expect(key.checks.map(({ name }) => name)).toContain(
        "api_key_owner_type_check",
      );
      expect(
        await em.execute(
          "select policyname from pg_policies where schemaname = 'public' and tablename = 'api_key'",
        ),
      ).toEqual([{ policyname: "api_key_all_policy" }]);
      const user = em.create(User, {
        name: "Alice",
        email: "alice@example.com",
        emailVerified: false,
      });
      em.persist(user);
      await em.flush();
      expect(await em.count(User)).toBe(1);
    } finally {
      await app.close();
    }
  },
);
