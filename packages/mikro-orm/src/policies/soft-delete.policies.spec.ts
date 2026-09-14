import { EntitySchema, MikroORM, type PolicyCallback } from "@mikro-orm/pglite";

import { softDeletePolicies as exportedPolicies } from "../index.js";
import { softDeletePolicies } from "./soft-delete.policies.js";

describe("softDeletePolicies", () => {
  it("is exported from the package entry point", () => {
    expect(exportedPolicies).toBe(softDeletePolicies);
  });

  it("uses native restrictive policies without granting a database role", () => {
    expect(softDeletePolicies()).toEqual([
      {
        type: "restrictive",
        command: "all",
        using: expect.any(Function),
        check: expect.any(Function),
      },
      {
        type: "restrictive",
        command: "delete",
        using: expect.any(Function),
      },
    ]);
  });

  it("defaults to deletedAt and supports a custom mapped property", () => {
    const resolve = (property?: string) =>
      softDeletePolicies({ property })[0].using as PolicyCallback<
        Record<string, unknown>
      >;
    expect(resolve()({ deletedAt: "deleted_at" } as never, {} as never)).toBe(
      '"deleted_at" is null',
    );
    expect(
      resolve("removedOn")({ removedOn: 'Removed"Date' } as never, {} as never),
    ).toBe('"Removed""Date" is null');
    expect(() => softDeletePolicies({ property: "" })).toThrow(/property/i);
    expect(() => resolve()({} as never, {} as never)).toThrow(/mapped column/i);
    expect(() => resolve("constructor")({} as never, {} as never)).toThrow(
      /mapped column/i,
    );
    expect(softDeletePolicies()).not.toBe(softDeletePolicies());
  });
});

describe("softDeletePolicies database behavior", () => {
  let orm: MikroORM;
  const entity = new EntitySchema<{
    id: number;
    name: string;
    retiredAt?: Date | null;
  }>({
    name: "SoftDeletePolicyProbe",
    tableName: "soft_delete_policy_probe",
    properties: {
      id: { type: "number", primary: true },
      name: { type: "string" },
      retiredAt: { type: "Date", nullable: true, fieldName: "deleted_at" },
    },
    policies: [
      // Grant every operation so denials come from the restrictive policies,
      // not from missing permissive policies or table privileges.
      {
        command: "all",
        roles: ["policy_test"],
        using: () => "true",
        check: () => "true",
      },
      ...softDeletePolicies({ property: "retiredAt" }),
    ],
  });
  const scoped = () => orm.em.fork({ session: { role: "policy_test" } });

  beforeAll(async () => {
    orm = await MikroORM.init({ dbName: "memory://", entities: [entity] });
    await orm.em.execute("create role policy_test nologin");
    await orm.schema.create();
    await orm.em.execute(
      "grant select, insert, update, delete on soft_delete_policy_probe to policy_test",
    );
    await orm.em.execute(
      "insert into soft_delete_policy_probe (id, name, deleted_at) values (1, 'Active', null), (2, 'Deleted', now())",
    );
  }, 15_000);

  afterAll(async () => {
    await orm?.close();
  });

  it("allows normal inserts, reads, and updates", async () => {
    const em = scoped();
    await em.execute(
      "insert into soft_delete_policy_probe (id, name) values (3, 'New')",
    );
    expect(
      await em.execute("select id from soft_delete_policy_probe where id = 3"),
    ).toHaveLength(1);
    expect(
      await em.execute(
        "update soft_delete_policy_probe set name = 'Updated' where id = 3 returning id",
      ),
    ).toHaveLength(1);
  });

  it.each(["", " returning id"])(
    "rejects an already-deleted insert%s",
    async (returning) => {
      await expect(
        scoped().execute(
          `insert into soft_delete_policy_probe (id, name, deleted_at) values (4, 'Denied', now())${returning}`,
        ),
      ).rejects.toThrow(/row.level security/i);
    },
  );

  it("rejects direct soft deletion", async () => {
    await expect(
      scoped().execute(
        "update soft_delete_policy_probe set deleted_at = now() where id = 1",
      ),
    ).rejects.toThrow(/row.level security/i);
  });

  it("hides deleted rows and prevents restoring them", async () => {
    const em = scoped();
    expect(
      await em.execute("select id from soft_delete_policy_probe where id = 2"),
    ).toEqual([]);
    expect(
      await em.execute(
        "update soft_delete_policy_probe set deleted_at = null where id = 2 returning id",
      ),
    ).toEqual([]);
  });

  it("denies physical deletion even with a table-level DELETE grant", async () => {
    expect(
      await scoped().execute(
        "delete from soft_delete_policy_probe where id = 1 returning id",
      ),
    ).toEqual([]);
    expect(
      await orm.em.execute(
        "select id from soft_delete_policy_probe where id = 1",
      ),
    ).toHaveLength(1);
  });
});
