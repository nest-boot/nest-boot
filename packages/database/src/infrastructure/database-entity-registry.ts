import type { Options } from "@mikro-orm/core";
import { Inject, Injectable, type Type } from "@nestjs/common";
import { DiscoveryService, ModuleRef } from "@nestjs/core";

import {
  DATABASE_FEATURE_ENTITIES,
  type DatabaseEntityLoader,
} from "./database-entities.module.js";

/** Collects module-local registrations before the root ORM discovers metadata. */
@Injectable()
export class DatabaseEntityRegistry {
  private readonly registrations = new Map<
    string,
    Promise<NonNullable<Options["entities"]>>
  >();

  constructor(
    @Inject(DiscoveryService) private readonly discovery: DiscoveryService,
  ) {}

  /**
   * Resolves each feature factory once per application and connection.
   * @param contextName - Target database connection.
   * @returns Deduplicated entities contributed by imported feature modules.
   */
  getEntities(
    contextName = "default",
  ): Promise<NonNullable<Options["entities"]>> {
    let pending = this.registrations.get(contextName);
    if (!pending) {
      pending = this.collect(contextName);
      this.registrations.set(contextName, pending);
    }
    return pending;
  }

  private async collect(
    contextName: string,
  ): Promise<NonNullable<Options["entities"]>> {
    const entities: NonNullable<Options["entities"]> = [];
    for (const provider of this.discovery.getProviders()) {
      if (provider.token !== DATABASE_FEATURE_ENTITIES) {
        continue;
      }
      const registration = provider.instance as {
        loader: Type<DatabaseEntityLoader>;
        contextName?: string;
      };
      if ((registration.contextName ?? "default") !== contextName) {
        continue;
      }
      const moduleRef = provider.host?.providers.get(ModuleRef)
        ?.instance as ModuleRef;
      const loader = await moduleRef.create(registration.loader);
      entities.push(...((await loader.load()) ?? []));
    }
    return [...new Set(entities)];
  }
}
