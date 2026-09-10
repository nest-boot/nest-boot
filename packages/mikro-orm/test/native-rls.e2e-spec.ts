import { randomUUID } from "node:crypto";

import { EntityManager, type ForkOptions, MikroORM, t } from "@mikro-orm/core";
import {
  Entity,
  PrimaryKey,
  Property,
  ReflectMetadataProvider,
} from "@mikro-orm/decorators/legacy";
import { PgliteDriver } from "@mikro-orm/pglite";
import { RequestContext } from "@nest-boot/request-context";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { MikroOrmModule } from "../src/index.js";

describe("native RLS with PGlite", () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
  const reader = `nb_reader_${suffix}`;
  const anonymous = `nb_anonymous_${suffix}`;
  const table = `nb_rls_${suffix}`;
  let module: TestingModule;
  let orm: MikroORM<PgliteDriver>;

  @Entity({
    tableName: table,
    policies: [
      {
        name: "workspace_policy",
        roles: [reader],
        using: (columns) =>
          `${columns.workspace} = current_setting('app.workspace', true)`,
        check: (columns) =>
          `${columns.workspace} = current_setting('app.workspace', true)`,
      },
    ],
  })
  class Record {
    @PrimaryKey({ type: t.integer })
    id!: number;

    @Property({ type: t.string })
    workspace!: string;

    @Property({ type: t.string })
    value!: string;
  }

  const session = (): ForkOptions["session"] => ({
    role: anonymous,
    variables: {
      "app.workspace": RequestContext.get<string>("workspace") ?? "",
    },
  });

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        MikroOrmModule.forRootAsync({
          driverHint: PgliteDriver,
          useFactory: () => ({
            driver: PgliteDriver,
            dbName: "memory://",
            entities: [Record],
            metadataProvider: ReflectMetadataProvider,
            session,
          }),
        }),
      ],
    }).compile();
    await module.init();
    orm = module.get(MikroORM);
    const connection = orm.em.getConnection();
    await connection.execute(`create role "${reader}" nologin`);
    await connection.execute(`create role "${anonymous}" nologin`);
    await connection.execute(
      `grant "${reader}", "${anonymous}" to current_user`,
    );
    await orm.schema.create();
    await connection.execute(
      `grant select, insert, update, delete on "${table}" to "${reader}", "${anonymous}"`,
    );
    await orm.em.fork().insertMany(Record, [
      { id: 1, workspace: "one", value: "One" },
      { id: 2, workspace: "two", value: "Two" },
    ]);
  }, 30_000);

  afterAll(async () => {
    if (orm) {
      const connection = orm.em.getConnection();
      await connection.execute(`drop table if exists "${table}" cascade`);
      await connection.execute(`drop role if exists "${reader}"`);
      await connection.execute(`drop role if exists "${anonymous}"`);
    }
    await module?.close();
  });

  async function request<T>(
    workspace: string,
    callback: (em: typeof orm.em) => Promise<T>,
  ) {
    const context = new RequestContext({ type: "test" });
    context.set("workspace", workspace);
    return await RequestContext.run(context, () =>
      callback(orm.em.getContext()),
    );
  }

  it("initializes app.workspace with an anonymous role before authentication", async () => {
    await request("one", async (em) => {
      expect(RequestContext.get(EntityManager)).toBe(em);
      expect(em.getSessionContext()).toEqual({
        role: anonymous,
        variables: { "app.workspace": "one" },
      });
      expect(await em.find(Record, {})).toEqual([]);
      em.setSessionContext({ role: reader });
      expect((await em.find(Record, {})).map((row) => row.id)).toEqual([1]);
    });
  });

  it("keeps concurrent request managers and session values separate", async () => {
    const managers = new Set<EntityManager>();
    const results = await Promise.all(
      ["one", "two", "missing"].map((workspace) =>
        request(workspace, async (em) => {
          managers.add(em);
          em.setSessionContext({ role: reader });
          return (await em.find(Record, {})).map((row) => row.id);
        }),
      ),
    );
    expect(managers.size).toBe(3);
    expect(results).toEqual([[1], [2], []]);
  });

  it("applies the session to ORM writes and context-aware raw queries", async () => {
    await request("one", async (em) => {
      em.setSessionContext({ role: reader });
      expect(await em.execute(`select id from "${table}" order by id`)).toEqual(
        [{ id: 1 }],
      );
      await expect(
        em.insert(Record, { id: 3, workspace: "two", value: "Denied" }),
      ).rejects.toThrow(/row.level security/i);
      await em.insert(Record, { id: 3, workspace: "one", value: "Allowed" });
      expect(
        await em.nativeUpdate(Record, { id: 2 }, { value: "Denied" }),
      ).toBe(0);
      expect(await em.nativeDelete(Record, { id: 3 })).toBe(1);
    });
  });

  it("preserves the native low-level connection bypass", async () => {
    await request("one", async (em) => {
      expect(await em.find(Record, {})).toEqual([]);
      expect(
        await em
          .getConnection()
          .execute(`select id from "${table}" order by id`),
      ).toEqual([{ id: 1 }, { id: 2 }]);
    });
  });

  it("rejects changing or clearing a session during a transaction", async () => {
    await request("one", async (em) => {
      em.setSessionContext({ role: reader });
      await em.transactional(async (tx) => {
        expect(() => {
          tx.setSessionContext({ role: anonymous });
        }).toThrow();
        expect(() => {
          tx.clearSessionContext();
        }).toThrow();
        expect((await tx.find(Record, {})).map((row) => row.id)).toEqual([1]);
      });
    });
  });

  it("cleans connection state after rollback and after a cleared session", async () => {
    await request("one", async (em) => {
      em.setSessionContext({ role: reader });
      await expect(
        em.transactional(async (tx) => {
          await tx.nativeDelete(Record, 1);
          throw new Error("rollback");
        }),
      ).rejects.toThrow("rollback");
      em.clearSessionContext();
      expect(await em.count(Record)).toBe(2);
    });
    await request("two", async (em) => {
      expect(await em.count(Record)).toBe(0);
      em.setSessionContext({ role: reader });
      expect((await em.find(Record, {})).map((row) => row.id)).toEqual([2]);
    });
  });

  it("separates result cache entries by session context", async () => {
    for (const [workspace, id] of [
      ["one", 1],
      ["two", 2],
    ] as const) {
      await request(workspace, async (em) => {
        em.setSessionContext({ role: reader });
        expect(
          (
            await em.find(Record, {}, { cache: ["shared-rls-key", 10_000] })
          ).map((row) => row.id),
        ).toEqual([id]);
      });
    }
  });

  it("introspects native policies without schema drift", async () => {
    expect(await orm.schema.getUpdateSchemaSQL({ wrap: false })).toBe("");
  });

  it("detects policy-only changes through the native schema generator", async () => {
    const metadata = orm.getMetadata(Record);
    const original = metadata.policies[0].check;
    metadata.policies[0].check = "false";
    try {
      const sql = await orm.schema.getUpdateSchemaSQL({ wrap: false });
      expect(sql).toContain("drop policy");
      expect(sql).toContain("create policy");
      expect(sql).toContain("with check (false)");
    } finally {
      metadata.policies[0].check = original;
    }
  });
});
