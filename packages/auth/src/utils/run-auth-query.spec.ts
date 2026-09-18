import {
  EntityManager as CoreEntityManager,
  type SessionContext,
  t,
} from "@mikro-orm/core";
import { Entity, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";
import { MikroORM } from "@mikro-orm/pglite";
import { RequestContext } from "@nest-boot/request-context";

import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { createContextualAuthService } from "../infrastructure/create-contextual-auth-service.js";
import { clearRequestAuthentication } from "./clear-request-authentication.util.js";
import { runAuthQuery } from "./run-auth-query.js";

@Entity({
  policies: [
    {
      name: "auth_record_workspace",
      roles: ["auth_query_reader"],
      using: (columns) =>
        `${columns.workspace} = current_setting('app.workspace.id', true)`,
      check: (columns) =>
        `${columns.workspace} = current_setting('app.workspace.id', true)`,
    },
  ],
})
class AuthRecord {
  @PrimaryKey({ type: t.integer })
  id!: number;

  @Property({ type: t.string })
  workspace!: string;

  @Property({ type: t.string })
  name!: string;
}

describe("runAuthQuery with native RLS", () => {
  let orm: MikroORM;
  const session: SessionContext = {
    role: "auth_query_reader",
    variables: { "app.workspace.id": "one" },
  };

  beforeAll(async () => {
    orm = await MikroORM.init({
      dbName: "memory://",
      entities: [AuthRecord],
      context: () =>
        RequestContext.isActive()
          ? RequestContext.get(CoreEntityManager)
          : undefined,
    });
    await orm.em
      .getConnection()
      .execute("create role auth_query_reader nologin");
    await orm.schema.create();
    await orm.em
      .getConnection()
      .execute(
        "grant select, insert, update, delete on auth_record to auth_query_reader",
      );
    await orm.em
      .getConnection()
      .execute(
        "grant usage, select on all sequences in schema public to auth_query_reader",
      );
  }, 30_000);

  beforeEach(async () => {
    const em = orm.em.fork();
    await em.nativeDelete(AuthRecord, {});
    await em.insertMany(AuthRecord, [
      { id: 1, workspace: "one", name: "One" },
      { id: 2, workspace: "two", name: "Two" },
    ]);
  });

  afterAll(async () => {
    await orm?.close();
  });

  async function inRequest<T>(callback: (em: typeof orm.em) => Promise<T>) {
    const em = orm.em.fork({ session });
    const ctx = new RequestContext({ type: "test" });
    ctx.set(CoreEntityManager, em);
    return await RequestContext.run(ctx, () => callback(em));
  }

  it("uses an isolated auth fork and restores the scoped manager afterward", async () => {
    await inRequest(async (em) => {
      expect(await em.count(AuthRecord)).toBe(1);
      await runAuthQuery(em, async (authEm) => {
        expect(authEm).not.toBe(em);
        expect(authEm.getSessionContext()).toBeUndefined();
        expect(RequestContext.get(CoreEntityManager)).toBe(authEm);
        expect(await authEm.count(AuthRecord)).toBe(2);
      });
      expect(RequestContext.get(CoreEntityManager)).toBe(em);
      expect(em.getSessionContext()).toEqual(session);
      expect(await em.count(AuthRecord)).toBe(1);
    });
  });

  it("does not copy pending application writes into the auth unit of work", async () => {
    await inRequest(async (em) => {
      em.create(AuthRecord, { id: 3, workspace: "two", name: "Pending" });
      await runAuthQuery(em, (authEm) => authEm.flush());
      expect(
        await orm.em
          .getConnection()
          .execute("select id from auth_record order by id"),
      ).toEqual([{ id: 1 }, { id: 2 }]);
    });
  });

  it.each([false, true])(
    "publishes child identity revocation only after success (failure=%s)",
    async (failure) => {
      await inRequest(async (em) => {
        const user = Object.assign(new User(), { id: "current" });
        const currentSession = new Session();
        RequestContext.set(User, user);
        RequestContext.set(Session, currentSession);
        const operation = runAuthQuery(em, async (authEm) => {
          await authEm.getConnection().execute("select 1");
          clearRequestAuthentication(authEm);
          if (failure) throw new Error("Persistence failed");
          return "committed";
        });
        if (failure) {
          await expect(operation).rejects.toThrow("Persistence failed");
          expect(RequestContext.get(User)).toBe(user);
          expect(RequestContext.get(Session)).toBe(currentSession);
          expect(em.getSessionContext()).toEqual(session);
        } else {
          await expect(operation).resolves.toBe("committed");
          expect(RequestContext.get(User)).toBeNull();
          expect(RequestContext.get(Session)).toBeNull();
          expect(em.getSessionContext()).toMatchObject({
            role: "anonymous",
            variables: { "app.user.id": "" },
          });
        }
        expect(RequestContext.get(CoreEntityManager)).toBe(em);
      });
    },
  );

  it("supplies isolated managers only to explicitly listed service operations", async () => {
    class DomainService {
      constructor(private readonly em: CoreEntityManager) {}
      async read() {
        return await this.em.count(AuthRecord);
      }
      async bootstrap() {
        return await this.em.count(AuthRecord);
      }
      deletionContext() {
        return Promise.resolve(this.em.getSessionContext());
      }
    }
    await inRequest(async (em) => {
      const service = createContextualAuthService(
        em,
        (manager) => new DomainService(manager),
        {
          bootstrap: "authentication",
          deletionContext: "workspace-delete",
        },
      );
      expect(await service.read()).toBe(1);
      expect(await service.bootstrap()).toBe(2);
      expect(await service.deletionContext()).toEqual({
        ...session,
        variables: {
          ...session.variables,
          "app.operation": "auth.workspace.delete",
        },
      });
      expect(await service.read()).toBe(0);
      expect(RequestContext.get(CoreEntityManager)).toBe(em);
      expect(em.getSessionContext()).toEqual({
        ...session,
        variables: {
          "app.workspace.id": "",
        },
      });
      await em.transactional(async (tx) => {
        const transactional = createContextualAuthService(
          tx,
          (manager) => new DomainService(manager),
          {
            bootstrap: "authentication",
            deletionContext: "workspace-delete",
          },
        );
        await expect(transactional.bootstrap()).rejects.toThrow(
          "active RLS transaction",
        );
        await expect(transactional.deletionContext()).rejects.toThrow(
          "before starting a scoped transaction",
        );
      });
    });
  });

  it("persists only an explicitly supplied entity from a scoped manager", async () => {
    await inRequest(async (em) => {
      const record = await em.findOneOrFail(AuthRecord, 1);
      record.name = "Changed";
      await runAuthQuery(em, (authEm) => authEm.persist(record).flush());
    });
    expect((await orm.em.fork().findOneOrFail(AuthRecord, 1)).name).toBe(
      "Changed",
    );
  });

  it("restores the caller's scope when auth persistence rejects", async () => {
    await inRequest(async (em) => {
      await expect(
        runAuthQuery(em, () => Promise.reject(new Error("failed"))),
      ).rejects.toThrow("failed");
      expect(RequestContext.get(CoreEntityManager)).toBe(em);
      expect(em.getSessionContext()).toEqual(session);
    });
  });

  it("rejects bypassing an active scoped transaction without invoking the callback", async () => {
    await inRequest(async (em) => {
      await em.transactional(async (tx) => {
        const callback = vi.fn();
        await expect(runAuthQuery(tx, callback)).rejects.toThrow(
          "active RLS transaction",
        );
        expect(callback).not.toHaveBeenCalled();
        expect(await tx.count(AuthRecord)).toBe(1);
      });
    });
  });

  it("reuses an unscoped transaction and preserves rollback", async () => {
    const em = orm.em.fork();
    await expect(
      em.transactional(async (tx) => {
        await runAuthQuery(tx, async (authEm) => {
          expect(authEm).toBe(tx);
          await authEm.nativeDelete(AuthRecord, 2);
        });
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(await orm.em.fork().count(AuthRecord)).toBe(2);
  });

  it("works outside RequestContext, including a global manager", async () => {
    expect(RequestContext.isActive()).toBe(false);
    expect(await runAuthQuery(orm.em, (em) => em.count(AuthRecord))).toBe(2);
    const scoped = orm.em.fork({ session });
    expect(await runAuthQuery(scoped, (em) => em.count(AuthRecord))).toBe(2);
    expect(scoped.getSessionContext()).toEqual(session);
    expect(RequestContext.isActive()).toBe(false);
  });
});
