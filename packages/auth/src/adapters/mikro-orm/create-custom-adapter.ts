import { type EntityManager, LockMode } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import {
  RowLevelSecurity,
  RowLevelSecurityMode,
} from "@nest-boot/row-level-security";
import type {
  AdapterFactoryCustomizeAdapterCreator,
  Where,
} from "better-auth/adapters";

import type { AuthModuleOptions } from "../../auth-module-options.interface.js";
import { createEntityMetadataResolver } from "./entity-metadata-resolver.js";
import { convertWhereToMikroOrm } from "./where-compiler.js";

export interface CreateCustomAdapterOptions {
  em: EntityManager;
  entities: AuthModuleOptions["entities"];
  inTransaction?: boolean;
}

export function createMikroOrmCustomAdapter({
  em,
  entities,
  inTransaction = false,
}: CreateCustomAdapterOptions): AdapterFactoryCustomizeAdapterCreator {
  return (context) => {
    const resolver = createEntityMetadataResolver(em, entities, context);
    const convertWhere = (model: string, where: Required<Where>[]) =>
      convertWhereToMikroOrm(
        where,
        (field) => resolver.getColumnName(model, field),
        (field) => resolver.getPropertyName(model, field),
      );

    const findOneForUpdate = async (
      transactionalEntityManager: EntityManager,
      model: string,
      where: Required<Where>[],
    ) =>
      await transactionalEntityManager.findOne(
        resolver.getEntityClass(model),
        convertWhere(model, where),
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );

    const runInTransaction = async <T>(
      callback: (transactionalEntityManager: EntityManager) => Promise<T>,
    ): Promise<T> => {
      if (inTransaction) return await callback(em);
      return await em.transactional(callback);
    };

    const runUnrestricted = async <T>(
      callback: () => Promise<T>,
    ): Promise<T> => {
      const run = () => {
        RowLevelSecurity.setMode(RowLevelSecurityMode.DISABLED);
        return callback();
      };

      if (RequestContext.isActive()) return await RequestContext.child(run);
      return await RequestContext.run(
        new RequestContext({ type: "better-auth-adapter" }),
        run,
      );
    };

    return {
      create: async ({ data, model }) =>
        await runUnrestricted(async () => {
          const entity = em.create(
            resolver.getEntityClass(model),
            resolver.toEntityData(model, data) as any,
          );
          await em.persist(entity).flush();
          return resolver.toAdapterRecord(model, entity) as any;
        }),
      update: async ({ model, where, update }) =>
        await runUnrestricted(async () => {
          const entity = await em.findOne(
            resolver.getEntityClass(model),
            convertWhere(model, where),
          );

          if (!entity) return null;

          em.assign(
            entity,
            resolver.toEntityData(model, update as object) as any,
          );
          await em.flush();
          return resolver.toAdapterRecord(model, entity) as any;
        }),
      updateMany: async ({ model, where, update }) =>
        await runUnrestricted(
          async () =>
            await em.nativeUpdate(
              resolver.getEntityClass(model),
              convertWhere(model, where),
              resolver.toEntityData(model, update),
            ),
        ),
      delete: async ({ model, where }) => {
        await runUnrestricted(async () => {
          await em.nativeDelete(
            resolver.getEntityClass(model),
            convertWhere(model, where),
          );
        });
      },
      deleteMany: async ({ model, where }) =>
        await runUnrestricted(
          async () =>
            await em.nativeDelete(
              resolver.getEntityClass(model),
              convertWhere(model, where),
            ),
        ),
      consumeOne: async ({ model, where }) =>
        await runUnrestricted(
          async () =>
            await runInTransaction(async (transactionalEntityManager) => {
              const entity = await findOneForUpdate(
                transactionalEntityManager,
                model,
                where,
              );

              if (!entity) return null;

              await transactionalEntityManager.remove(entity).flush();
              return resolver.toAdapterRecord(model, entity) as any;
            }),
        ),
      incrementOne: async ({ model, where, increment, set }) =>
        await runUnrestricted(
          async () =>
            await runInTransaction(async (transactionalEntityManager) => {
              const entity = await findOneForUpdate(
                transactionalEntityManager,
                model,
                where,
              );

              if (!entity) return null;

              const record = entity as Record<string, unknown>;
              const mappedIncrement = resolver.toEntityData(model, increment);
              const update = resolver.toEntityData(model, set ?? {});

              for (const [field, delta] of Object.entries(mappedIncrement)) {
                const current = record[field];

                if (typeof current !== "number" || typeof delta !== "number") {
                  throw new TypeError(
                    `Cannot increment non-numeric field "${field}" on model "${model}"`,
                  );
                }

                update[field] = current + delta;
              }

              transactionalEntityManager.assign(entity, update);
              await transactionalEntityManager.flush();
              return resolver.toAdapterRecord(model, entity) as any;
            }),
        ),
      findOne: async ({ model, where }) =>
        await runUnrestricted(async () => {
          const entity = await em.findOne(
            resolver.getEntityClass(model),
            convertWhere(model, where),
          );

          return entity
            ? (resolver.toAdapterRecord(model, entity) as any)
            : null;
        }),
      findMany: async ({ model, where, limit, offset, sortBy }) =>
        await runUnrestricted(async () => {
          const result = await em.findAll(resolver.getEntityClass(model), {
            ...(where ? { where: convertWhere(model, where) } : {}),
            limit,
            offset: offset ?? 0,
            ...(sortBy
              ? {
                  orderBy: {
                    [resolver.getPropertyName(model, sortBy.field)]:
                      sortBy.direction,
                  },
                }
              : {}),
          });

          const adapterRecords = result.map(
            (entity) => resolver.toAdapterRecord(model, entity) as any,
          );

          return adapterRecords.every(
            (adapterRecord, index) => adapterRecord === result[index],
          )
            ? result
            : adapterRecords;
        }),
      count: async ({ model, where }) =>
        await runUnrestricted(
          async () =>
            await em.count(
              resolver.getEntityClass(model),
              where ? convertWhere(model, where) : undefined,
            ),
        ),
    };
  };
}
