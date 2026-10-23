import type { ModuleMetadata } from "@nestjs/common";
import { ModulesContainer } from "@nestjs/core";

import { MODULE_OPTIONS_TOKEN } from "./queue.module-definition.js";
import { QueueRegistrar } from "./queue.registrar.js";
import type { QueueModuleOptions } from "./queue-module-options.interface.js";

/**
 * Checks an optional peer without swallowing errors from installed packages.
 * @param name - The optional package name.
 * @returns Whether the package can be resolved from this package.
 */
function isAvailable(name: string): boolean {
  try {
    import.meta.resolve(name);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ERR_MODULE_NOT_FOUND") {
      return false;
    }
    throw error;
  }
}

/**
 * Builds optional providers; features activate only when their application services exist.
 * @returns Providers and exports for the installed integrations.
 */
export async function createJobProviders(): Promise<
  Required<Pick<ModuleMetadata, "providers" | "exports">>
> {
  const definition: Required<Pick<ModuleMetadata, "providers" | "exports">> = {
    providers: [],
    exports: [],
  };
  if (!isAvailable("@nest-boot/database")) {
    return definition;
  }

  const { DatabaseModule } = await import("@nest-boot/database");
  const { EntityManager } = await import("@mikro-orm/core");
  const { Job } = await import("./entities/job.entity.js");
  const { JobService } = await import("./services/job.service.js");

  definition.providers = [
    {
      provide: JobService,
      inject: [
        ModulesContainer,
        { token: EntityManager, optional: true },
        MODULE_OPTIONS_TOKEN,
        QueueRegistrar,
      ],
      useFactory: (
        modules: ModulesContainer,
        em: InstanceType<typeof EntityManager> | undefined,
        options: QueueModuleOptions,
        queues: QueueRegistrar,
      ) => {
        if (
          !em ||
          em.getMetadata().find(Job)?.class !== Job ||
          ![...modules.values()].some(
            (module) => module.metatype === DatabaseModule,
          )
        ) {
          return null;
        }
        return new JobService(em, options, queues);
      },
    },
  ];
  definition.exports = [JobService];

  if (isAvailable("@nest-boot/graphql")) {
    const { GraphQLModule } = await import("@nest-boot/graphql");
    const { JobConnectionService } =
      await import("./services/job-connection.service.js");
    definition.providers.push({
      provide: JobConnectionService,
      inject: [
        JobService,
        ModulesContainer,
        MODULE_OPTIONS_TOKEN,
        { token: EntityManager, optional: true },
        QueueRegistrar,
      ],
      useFactory: (
        service: InstanceType<typeof JobService> | null,
        modules: ModulesContainer,
        options: QueueModuleOptions,
        em: InstanceType<typeof EntityManager> | undefined,
        queues: QueueRegistrar,
      ) => {
        if (
          !service ||
          !em ||
          options.graphql === false ||
          ![...modules.values()].some(
            (module) => module.metatype === GraphQLModule,
          )
        ) {
          return null;
        }
        if (!isAvailable("@nest-boot/graphql-connection")) {
          throw new Error(
            "Queue GraphQL queries require @nest-boot/graphql-connection",
          );
        }
        return new JobConnectionService(em, options, queues);
      },
    });
    definition.providers.push({
      provide: Symbol("JobResolver"),
      inject: [JobConnectionService],
      useFactory: async (
        service: InstanceType<typeof JobConnectionService> | null,
      ) => {
        if (!service) {
          return null;
        }
        const { JobResolver } = await import("./resolvers/job.resolver.js");
        return new JobResolver(service);
      },
    });
    definition.exports.push(JobConnectionService);
  }
  return definition;
}
