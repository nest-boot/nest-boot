import { EntitySchema, MikroORM } from "@mikro-orm/pglite";

import { omitCredentials } from "./omit-credentials.util.js";

class CredentialRecord {
  id!: number;
  name!: string;
  token!: string;
  key!: string;
  password!: string;
  accessToken!: string;
  refreshToken!: string;
  idToken!: string;
}

const schema = new EntitySchema({
  class: CredentialRecord,
  properties: {
    id: { type: "integer", primary: true },
    name: { type: "string" },
    token: { type: "string" },
    key: { type: "string" },
    password: { type: "string" },
    accessToken: { type: "string" },
    refreshToken: { type: "string" },
    idToken: { type: "string" },
  },
});

describe("credential projection with a hydrated identity map", () => {
  let orm: MikroORM;
  beforeAll(async () => {
    orm = await MikroORM.init({ dbName: "memory://", entities: [schema] });
    await orm.schema.create();
  });
  afterAll(async () => {
    await orm?.close();
  });

  it.each([
    ["token"],
    ["key"],
    ["password", "accessToken", "refreshToken", "idToken"],
  ] as const)(
    "removes %j without changing managed credentials",
    async (...keys) => {
      const em = orm.em.fork();
      const managed = em.create(CredentialRecord, {
        name: "Original",
        token: "session-secret",
        key: "key-hash",
        password: "password-hash",
        accessToken: "access-secret",
        refreshToken: "refresh-secret",
        idToken: "id-secret",
      });
      await em.persist(managed).flush();
      const queried = await em.findOneOrFail(CredentialRecord, managed.id, {
        exclude: [...keys],
        refresh: true,
      });
      expect(queried).toBe(managed);
      for (const key of keys) expect(queried).toHaveProperty(key, managed[key]);

      const result = omitCredentials(queried, keys);
      expect(result).not.toBe(managed);
      expect(result).toBeInstanceOf(CredentialRecord);
      expect(result.name).toBe("Original");
      for (const key of keys) {
        expect(Reflect.get(result, key)).toBeUndefined();
        expect(Object.hasOwn(result, key)).toBe(false);
        expect(managed[key]).toBeTruthy();
      }
      expect(JSON.stringify(result)).not.toContain(managed[keys[0]]);

      managed.name = "Updated";
      await em.flush();
      const persisted = await em
        .fork()
        .findOneOrFail(CredentialRecord, managed.id);
      expect(persisted.name).toBe("Updated");
      for (const key of keys) expect(persisted[key]).toBe(managed[key]);
    },
  );
});
