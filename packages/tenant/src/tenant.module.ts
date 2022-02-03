/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  DynamicModule,
  Global,
  Module,
  ModuleMetadata,
  Provider,
} from "@nestjs/common";
import { PoolClient } from "pg";
// import { EntitiesMetadataStorage } from "@nestjs/typeorm/dist/entities-metadata.storage";
// import { getCustomRepositoryEntity } from "@nestjs/typeorm/dist/helpers/get-custom-repository-entity";
// import { EntityClassOrSchema } from "@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type";
import { Connection, ReplicationMode } from "typeorm";
import { PostgresDriver } from "typeorm/driver/postgres/PostgresDriver";

import { TENANT_CONNECTION } from "./constants";
import { TenantQueryRunner } from "./tenant.query-runner";

export interface TenantModuleOptions {
  getTenantId: () => number | string;
}

export interface TenantModuleAsyncOptions
  extends Pick<ModuleMetadata, "imports"> {
  inject?: any[];
  useFactory: (
    ...args: any[]
  ) => Promise<TenantModuleOptions> | TenantModuleOptions;
}

@Global()
@Module({})
export class TenantModule {
  static forRoot(options: TenantModuleOptions): DynamicModule {
    const TenantConnectionProvider: Provider = {
      provide: TENANT_CONNECTION,
      inject: [Connection],
      useFactory: (connection: Connection) => {
        if (connection.driver instanceof PostgresDriver) {
          const driver = connection.driver as PostgresDriver;

          // eslint-disable-next-line no-param-reassign
          driver.createQueryRunner = (mode: ReplicationMode) => {
            return new TenantQueryRunner(driver, mode);
          };

          // eslint-disable-next-line no-param-reassign
          driver.obtainMasterConnection = () => {
            return new Promise((ok, fail) => {
              driver.master.connect(
                (err: Error, client: PoolClient, release: any) => {
                  console.log("@@ connect");

                  if (err) {
                    fail(err);
                  } else {
                    ok([
                      new Proxy(client, {
                        get: (
                          target: PoolClient,
                          propertyKey: PropertyKey,
                          receiver: any
                        ) => {
                          if (propertyKey === "query") {
                            return async (query: string, values: any[]) => {
                              console.log("@@ query", query, values);

                              const tenantId = "111";

                              await target.query(
                                `SET "app.current_tenant_id" = '1';`
                              );
                              const result = await target.query(query, values);
                              await target.query(
                                `RESET "app.current_tenant_id";`
                              );

                              return result;
                            };
                          }

                          return Reflect.get(target, propertyKey, receiver);
                        },
                      }),
                      (...args: any[]) => {
                        console.log("@@ release");

                        return release(...args);
                      },
                    ]);
                  }
                }
              );
            });
          };
        }

        return connection;
      },
    };

    return {
      module: TenantModule,
      providers: [TenantConnectionProvider],
      exports: [TenantConnectionProvider],
    };
  }
}
