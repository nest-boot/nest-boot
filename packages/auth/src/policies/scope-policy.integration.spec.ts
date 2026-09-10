import { EntitySchema, MikroORM } from "@mikro-orm/pglite";

import { userScopePolicy, workspaceScopePolicy } from "../index.js";

const types = [
  { type: "bigint", own: "11", other: "12" },
  { type: "integer", own: "11", other: "12" },
  {
    type: "uuid",
    own: "11111111-1111-4111-8111-111111111111",
    other: "22222222-2222-4222-8222-222222222222",
  },
  { type: "text", own: "own", other: "other" },
] as const;
const scopes = [
  { scope: "user", create: userScopePolicy },
  { scope: "workspace", create: workspaceScopePolicy },
] as const;
const fixtures = scopes.flatMap(({ scope, create }) =>
  types.flatMap((type, index) =>
    [false, true].map((relation) => {
      const table = `scope_${scope}_${String(index)}_${String(Number(relation))}`;
      class Parent {
        id!: string;
      }
      class Probe {
        id!: number;
        owner!: string | Parent;
      }
      const parent = new EntitySchema({
        class: Parent,
        name: `Parent_${table}`,
        tableName: `parent_${table}`,
        properties: {
          id: { type: type.type, primary: true, autoincrement: false },
        },
      });
      const entity = new EntitySchema({
        class: Probe,
        name: `Probe_${table}`,
        tableName: table,
        properties: {
          id: { type: "integer", primary: true, autoincrement: false },
          owner: relation
            ? { kind: "m:1", entity: () => Parent, fieldName: "OwnerRef" }
            : { type: type.type, fieldName: "OwnerRef" },
        },
        policies: [create({ type: type.type, property: "owner" })],
      });
      return { ...type, scope, relation, table, parent, entity };
    }),
  ),
);

describe("scope policy factories with native PGlite RLS", () => {
  let orm: MikroORM;
  const readonlyEntity = new EntitySchema<{ id: number; user: string }>({
    name: "ReadonlyMembership",
    tableName: "readonly_membership",
    properties: {
      id: { type: "integer", primary: true },
      user: { type: "bigint" },
    },
    policies: [userScopePolicy({ command: "select" })],
  });
  const initialize = () =>
    MikroORM.init({
      dbName: "memory://",
      metadataCache: { enabled: false },
      entities: [
        ...fixtures.flatMap(({ parent, entity }) => [parent, entity]),
        readonlyEntity,
      ],
    });
  beforeAll(async () => {
    // No framework module, discovery callbacks or filters.
    orm = await initialize();
    await orm.em.execute("create role authenticated nologin");
    await orm.schema.create();
    await orm.em.execute(
      "grant all on all tables in schema public to authenticated",
    );
    await orm.em.execute(
      'insert into readonly_membership (id, "user") values (1, 11), (2, 12)',
    );
    for (const { table, own, other } of fixtures) {
      await orm.em.execute(`insert into parent_${table} (id) values (?), (?)`, [
        own,
        other,
      ]);
      await orm.em.execute(
        `insert into ${table} (id, "OwnerRef") values (1, ?), (2, ?)`,
        [own, other],
      );
    }
  }, 20_000);
  afterAll(async () => {
    await orm?.close();
  });
  const scoped = (scope: string, id: string) =>
    orm.em.fork({
      session: { role: "authenticated", variables: { [`app.${scope}`]: id } },
    });

  it.each(fixtures)(
    "enforces all operations for $scope / $type / relation=$relation",
    async ({ scope, table, own, other }) => {
      const em = scoped(scope, own);
      expect(await em.execute(`select id from ${table}`)).toEqual([{ id: 1 }]);
      expect(
        await em.execute(
          `update ${table} set "OwnerRef" = "OwnerRef" where id = 2 returning id`,
        ),
      ).toEqual([]);
      await expect(
        em.execute(`update ${table} set "OwnerRef" = ? where id = 1`, [other]),
      ).rejects.toThrow(/row.level security/i);
      await expect(
        em.execute(`insert into ${table} (id, "OwnerRef") values (3, ?)`, [
          other,
        ]),
      ).rejects.toThrow(/row.level security/i);
      expect(
        await em.execute(
          `insert into ${table} (id, "OwnerRef") values (4, ?) returning id`,
          [own],
        ),
      ).toEqual([{ id: 4 }]);
      expect(
        await em.execute(
          `update ${table} set "OwnerRef" = "OwnerRef" where id = 4 returning id`,
        ),
      ).toEqual([{ id: 4 }]);
      expect(
        await em.execute(`delete from ${table} where id = 2 returning id`),
      ).toEqual([]);
      expect(
        await em.execute(`delete from ${table} where id = 4 returning id`),
      ).toEqual([{ id: 4 }]);
    },
  );

  it.each(fixtures)(
    "fails closed for missing/empty $scope / $type / relation=$relation",
    async ({ scope, table }) => {
      expect(
        await scoped(scope, "").execute(`select id from ${table}`),
      ).toEqual([]);
      const em = orm.em.fork({ session: { role: "authenticated" } });
      expect(await em.execute(`select id from ${table}`)).toEqual([]);
    },
  );

  it("keeps explicit SELECT-only user policies read-only despite table grants", async () => {
    const em = scoped("user", "11");
    expect(await em.execute("select id from readonly_membership")).toEqual([
      { id: 1 },
    ]);
    expect(
      await em.execute(
        'update readonly_membership set "user" = 11 where id = 1 returning id',
      ),
    ).toEqual([]);
    expect(
      await em.execute(
        "delete from readonly_membership where id = 1 returning id",
      ),
    ).toEqual([]);
    await expect(
      em.execute('insert into readonly_membership (id, "user") values (3, 11)'),
    ).rejects.toThrow(/row.level security/i);
  });

  it("preserves callbacks across rediscovery and produces no schema drift", async () => {
    const second = await initialize();
    try {
      for (const { entity } of fixtures)
        expect(second.getMetadata(entity).policies).toEqual(
          orm.getMetadata(entity).policies,
        );
      expect(await orm.schema.getUpdateSchemaSQL({ wrap: false })).toBe("");
    } finally {
      await second.close();
    }
  });
});
