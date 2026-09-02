import type { MikroORM } from "@mikro-orm/core";
import type { BetterAuthOptions } from "better-auth";
import {
  createAdapterFactory,
  type DBAdapterDebugLogOption,
} from "better-auth/adapters";

import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { createMikroOrmAdapterConfig } from "./mikro-orm/adapter-config.js";
import { createMikroOrmCustomAdapter } from "./mikro-orm/create-custom-adapter.js";

export { convertWhereToMikroOrm } from "./mikro-orm/where-compiler.js";

export interface MikroOrmAdapterConfig {
  /** The MikroORM instance. */
  orm: MikroORM;
  /** The entities to use for the adapter. */
  entities: AuthModuleOptions["entities"];
  /** Helps you debug issues with the adapter. */
  debugLogs?: DBAdapterDebugLogOption;
}

export const mikroOrmAdapter = ({
  orm,
  entities,
  debugLogs,
}: MikroOrmAdapterConfig) => {
  return (options: BetterAuthOptions) => {
    const adapterConfig = createMikroOrmAdapterConfig(debugLogs);
    const adapterFactory = createAdapterFactory({
      config: {
        ...adapterConfig,
        transaction: async (callback) =>
          await orm.em.transactional(async (em) => {
            const transactionAdapter = createAdapterFactory({
              config: {
                ...adapterConfig,
                transaction: false,
              },
              adapter: createMikroOrmCustomAdapter({
                em,
                entities,
                inTransaction: true,
              }),
            })(options);

            return await callback(transactionAdapter);
          }),
      },
      adapter: createMikroOrmCustomAdapter({ em: orm.em, entities }),
    });

    return adapterFactory(options);
  };
};
