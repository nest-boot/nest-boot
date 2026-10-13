import { EntitySchema } from "@mikro-orm/core";
import { expect, it } from "vitest";

import { entities, User } from "./entities/index.js";
import { withAuthDatabaseConfig } from "./with-auth-database-config.js";

it("merges Auth entities without changing application configuration", () => {
  const custom = new EntitySchema({
    name: "Custom",
    properties: { id: { type: "integer", primary: true } },
  });
  const session = () => ({ role: "anonymous" });
  const config = Object.freeze({
    entities: [custom, User, "dist/**/*.entity.js", "dist/**/*.entity.js"],
    entitiesTs: [custom, "src/**/*.entity.ts"],
    session,
    migrations: { path: "custom/migrations" },
  });
  const result = withAuthDatabaseConfig(config);
  expect(result.entities).toEqual([
    custom,
    User,
    "dist/**/*.entity.js",
    ...entities.filter((entity) => entity !== User),
  ]);
  expect(result.entitiesTs).toEqual([
    custom,
    "src/**/*.entity.ts",
    ...entities,
  ]);
  expect(result.session).toBe(session);
  expect(result.migrations).toBe(config.migrations);
  expect(config.entities).toHaveLength(4);
  expect(result).not.toBe(config);
  expect(withAuthDatabaseConfig(result)).toEqual(result);
});

it("registers Auth for both runtime and TypeScript discovery without existing entities", () => {
  const result = withAuthDatabaseConfig({});
  expect(result.entities).toEqual(entities);
  expect(result.entitiesTs).toEqual(entities);
});

it.each([undefined, []])(
  "keeps runtime application entities when entitiesTs is %s",
  (entitiesTs) => {
    const result = withAuthDatabaseConfig({
      entities: ["custom/entities"],
      entitiesTs,
    });
    expect(result.entitiesTs).toEqual(["custom/entities", ...entities]);
  },
);
