import { MikroORM } from "@mikro-orm/core";
import { type MikroORM as PgliteORM, PgliteDriver } from "@mikro-orm/pglite";
import { DatabaseModule } from "@nest-boot/database";
import { HashService } from "@nest-boot/hash";
import { Mailer } from "@nest-boot/mailer";
import { Global, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { AuthModule } from "../src/core/auth.module.js";
import {
  entities,
  User,
  workspaceEntities,
} from "../src/core/entities/index.js";
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
  "registers every existing auth entity without a CLI config (async: %s)",
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
        expect(orm.getMetadata().has<object>(entity)).toBe(true);
      }
      expect(factory).toHaveBeenCalledTimes(asyncOptions ? 1 : 0);
      await orm.em.execute("create role authenticated nologin");
      await orm.em.execute("create role anonymous nologin");
      await orm.schema.create();
      const em = orm.em.fork();
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
