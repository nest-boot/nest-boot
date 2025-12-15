import { BaseEntity, EntityClass, MikroORM } from "@mikro-orm/core";
import {
  createAdapterFactory,
  type DBAdapterDebugLogOption,
  Where,
} from "better-auth/adapters";

import {
  BaseAccount,
  BaseSession,
  BaseUser,
  BaseVerification,
} from "../entities";

export interface MikroOrmAdapterConfig {
  /**
   * The MikroORM instance.
   */
  orm: MikroORM;
  /**
   * The entities to use for the adapter.
   */
  entities: {
    account: EntityClass<BaseAccount>;
    session: EntityClass<BaseSession>;
    user: EntityClass<BaseUser>;
    verification: EntityClass<BaseVerification>;
  };
  /**
   * Helps you debug issues with the adapter.
   */
  debugLogs?: DBAdapterDebugLogOption;
}

function convertWhereToMikroOrm(where: Required<Where>[]) {
  return where.map(({ field, operator, value }) => {
    switch (operator) {
      case "eq":
        return {
          [field]: {
            $eq: value,
          },
        };
      case "ne":
        return {
          [field]: {
            $ne: value,
          },
        };
      case "lt":
        return {
          [field]: {
            $lt: value,
          },
        };
      case "lte":
        return {
          [field]: {
            $lte: value,
          },
        };
      case "gt":
        return {
          [field]: {
            $gt: value,
          },
        };
      case "gte":
        return {
          [field]: {
            $gte: value,
          },
        };
      case "in":
        return {
          [field]: {
            $in: value,
          },
        };
      case "not_in":
        return {
          [field]: {
            $nin: value,
          },
        };
      case "contains":
        if (typeof value !== "string") {
          throw new Error("Value must be a string");
        }

        return {
          [field]: {
            $like: `%${value}%`,
          },
        };
      case "starts_with":
        if (typeof value !== "string") {
          throw new Error("Value must be a string");
        }

        return {
          [field]: {
            $like: `${value}%`,
          },
        };
      case "ends_with":
        if (typeof value !== "string") {
          throw new Error("Value must be a string");
        }

        return {
          [field]: {
            $like: `%${value}`,
          },
        };
    }
  });
}

export const mikroOrmAdapter = ({
  orm,
  entities,
  ...config
}: MikroOrmAdapterConfig) => {
  const getEntityClass = (model: string): EntityClass<BaseEntity> => {
    return entities[model as keyof typeof entities];
  };

  return createAdapterFactory({
    config: {
      adapterId: "mikro-orm-adapter", // A unique identifier for the adapter.
      adapterName: "MikroORM Adapter", // The name of the adapter.
      usePlural: false, // Whether the table names in the schema are plural.
      debugLogs: config.debugLogs ?? false, // Whether to enable debug logs.
      supportsJSON: true, // Whether the database supports JSON. (Default: false)
      supportsDates: true, // Whether the database supports dates. (Default: true)
      supportsBooleans: true, // Whether the database supports booleans. (Default: true)
      supportsNumericIds: true, // Whether the database supports auto-incrementing numeric IDs. (Default: true)
      disableIdGeneration: true, // Whether to disable id generation. (Default: false)
      ...config,
    },
    adapter: () => {
      return {
        create: async ({ data, model }) => {
          const entity = orm.em.create(getEntityClass(model), data);
          await orm.em.persist(entity).flush();
          return entity as any;
        },
        update: async ({ model, where, update }) => {
          const entity = await orm.em.findOne(
            getEntityClass(model),
            convertWhereToMikroOrm(where),
          );

          if (!entity) {
            return null;
          }

          orm.em.assign(entity, update as any);

          await orm.em.flush();

          return entity as any;
        },
        updateMany: async ({ model, where, update }) => {
          return await orm.em.nativeUpdate(
            getEntityClass(model),
            convertWhereToMikroOrm(where),
            update,
          );
        },
        delete: async ({ model, where }) => {
          await orm.em.nativeDelete(
            getEntityClass(model),
            convertWhereToMikroOrm(where),
          );
        },
        deleteMany: async ({ model, where }) => {
          return await orm.em.nativeDelete(
            getEntityClass(model),
            convertWhereToMikroOrm(where),
          );
        },
        findOne: async ({ model, where }) => {
          const entity = await orm.em.findOne(
            getEntityClass(model),
            convertWhereToMikroOrm(where),
          );

          return entity as any;
        },
        findMany: async ({ model, where, limit, offset, sortBy }) => {
          const result = await orm.em.findAll(getEntityClass(model), {
            ...(where ? { where: convertWhereToMikroOrm(where) } : {}),
            limit: limit,
            offset: offset ?? 0,
            ...(sortBy
              ? {
                  orderBy: {
                    [sortBy.field]: sortBy.direction,
                  },
                }
              : {}),
          });

          return result as any;
        },
        count: async ({ model, where }) => {
          return await orm.em.count(
            getEntityClass(model),
            where ? convertWhereToMikroOrm(where) : undefined,
          );
        },
      };
    },
  });
};
