import type { Options } from "@mikro-orm/core";
import { type DynamicModule, Inject, Module, Optional } from "@nestjs/common";

import type { DatabaseFeatureOptions } from "./interfaces/database-feature-options.interface.js";

/** Internal descriptor token; each feature module owns its own registration. */
export const DATABASE_FEATURE_ENTITIES = Symbol("DatabaseFeatureEntities");

/** Resolves a feature's entities after its configuration dependencies are ready. */
export interface DatabaseEntityLoader {
  load(): Options["entities"] | Promise<Options["entities"]>;
}

/** Isolates configuration dependencies from the feature's ORM-dependent services. */
@Module({})
export class DatabaseEntitiesModule {
  /**
   * Registers an entity factory without eagerly instantiating ORM-dependent feature services.
   * @param options - Feature imports, configuration dependencies, and entity factory.
   * @returns Module containing the entity registration descriptor.
   */
  static register(options: DatabaseFeatureOptions): DynamicModule {
    class EntityLoader implements DatabaseEntityLoader {
      private readonly dependencies: unknown[];
      constructor(...dependencies: unknown[]) {
        this.dependencies = dependencies;
      }
      load() {
        return options.useFactory(...this.dependencies);
      }
    }
    // Nest resolves factory parameters through the feature's imports before ORM initialization.
    for (const [index, dependency] of (options.inject ?? []).entries()) {
      const optional = typeof dependency === "object" && "token" in dependency;
      Inject(optional ? dependency.token : dependency)(
        EntityLoader,
        undefined,
        index,
      );
      if (optional && dependency.optional) {
        Optional()(EntityLoader, undefined, index);
      }
    }
    return {
      module: DatabaseEntitiesModule,
      imports: options.imports,
      providers: [
        {
          provide: DATABASE_FEATURE_ENTITIES,
          useValue: {
            loader: EntityLoader,
            contextName: options.contextName,
          },
        },
      ],
    };
  }
}
