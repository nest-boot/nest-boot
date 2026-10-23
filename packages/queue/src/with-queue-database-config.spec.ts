import { EntitySchema, type Options } from "@mikro-orm/core";
import { MikroORM } from "@mikro-orm/pglite";
import { expect, it, vi } from "vitest";

import { entities, Job, QueueEvent } from "./entities/index.js";
import { withQueueDatabaseConfig } from "./with-queue-database-config.js";

it("merges entities, nested options and request configuration without mutation", () => {
  const onMetadata = vi.fn();
  const afterDiscovered = vi.fn();
  const session = () => ({ role: "anonymous" });
  const config = Object.freeze({
    entities: [Job, "dist/**/*.entity.js", Job],
    entitiesTs: ["src/**/*.entity.ts"],
    schema: "application",
    session,
    discovery: { onMetadata, afterDiscovered, warnWhenNoEntities: false },
    schemaGenerator: {
      ignoreRoutines: false,
      createForeignKeyConstraints: false,
    },
  });
  const result = withQueueDatabaseConfig(config, "tasks");
  expect(result.entities).toEqual([
    Job,
    "dist/**/*.entity.js",
    ...entities.filter((entity) => entity !== Job),
  ]);
  expect(result.entitiesTs).toEqual(["src/**/*.entity.ts", ...entities]);
  expect(result.schema).toBe("application");
  expect(result.session).toBe(session);
  expect(result.discovery.afterDiscovered).toBe(afterDiscovered);
  expect(result.discovery.warnWhenNoEntities).toBe(false);
  expect(result.schemaGenerator).toEqual({
    ignoreRoutines: true,
    createForeignKeyConstraints: false,
  });
  expect(config.schemaGenerator.ignoreRoutines).toBe(false);
  expect(config.entities).toHaveLength(3);
  expect(config.discovery.onMetadata).toBe(onMetadata);
  expect(withQueueDatabaseConfig(result, "tasks").entities).toEqual(
    result.entities,
  );
});

it.each([false, true])(
  "preserves %s async metadata hooks with custom schema discovery",
  async (asyncHook) => {
    const custom = new EntitySchema({
      name: "Custom",
      properties: { id: { type: "integer", primary: true } },
    });
    const visited: string[] = [];
    const onMetadata: NonNullable<Options["discovery"]["onMetadata"]> = (
      meta,
    ) => {
      const update = () => {
        visited.push(meta.className);
        meta.schema = "application";
      };
      if (asyncHook) {
        return Promise.resolve().then(update);
      }
      update();
    };
    const config = withQueueDatabaseConfig(
      {
        dbName: "memory://",
        entities: [custom],
        entitiesTs: asyncHook ? [] : undefined,
        metadataCache: { enabled: false },
        discovery: { onMetadata },
      },
      "task's schema",
    );
    const orm = await MikroORM.init(config);
    try {
      expect(visited).toContain("Custom");
      expect(visited).toContain("Job");
      expect(orm.getMetadata().get(custom).schema).toBe("application");
      for (const entity of entities) {
        expect(orm.getMetadata().get<object>(entity).schema).toBe(
          "task's schema",
        );
      }
      expect(orm.getMetadata(QueueEvent).properties.id.defaultRaw).toBe(
        `nextval('"task''s schema".event_seq'::regclass)`,
      );
      expect(orm.config.get("schemaGenerator").ignoreRoutines).toBe(true);
    } finally {
      await orm.close();
    }
  },
);
