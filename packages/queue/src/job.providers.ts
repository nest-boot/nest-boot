import type { ModuleMetadata } from "@nestjs/common";
import { DiscoveryService, ModulesContainer } from "@nestjs/core";

import { JOB_SERVICE, MODULE_OPTIONS_TOKEN } from "./queue.constants.js";
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
    if ((error as NodeJS.ErrnoException).code === "ERR_MODULE_NOT_FOUND")
      return false;
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
    providers: [{ provide: JOB_SERVICE, useValue: null }],
    exports: [JOB_SERVICE],
  };
  if (!isAvailable("@nest-boot/database")) return definition;

  const { DatabaseModule } = await import("@nest-boot/database");
  const { EntityManager } = await import("@mikro-orm/core");
  const { Job } = await import("./entities/job.entity.js");
  const { JobService } = await import("./services/job.service.js");

  definition.providers = [
    {
      provide: JobService,
      inject: [
        DiscoveryService,
        ModulesContainer,
        { token: EntityManager, optional: true },
        MODULE_OPTIONS_TOKEN,
      ],
      useFactory: (
        discovery: DiscoveryService,
        modules: ModulesContainer,
        em: InstanceType<typeof EntityManager> | undefined,
        options: QueueModuleOptions,
      ) => {
        if (
          options.persistence?.enabled === false ||
          !em ||
          ![...modules.values()].some(
            (module) => module.metatype === DatabaseModule,
          )
        )
          return null;
        if (
          !em.getMetadata().has(Job) ||
          em.getMetadata().get(Job).class !== Job
        )
          return null;
        return new JobService(discovery, em, options);
      },
    },
  ];
  definition.providers.push({
    provide: JOB_SERVICE,
    useExisting: JobService,
  });
  definition.exports = [JOB_SERVICE, JobService];

  if (isAvailable("@nest-boot/graphql")) {
    const { GraphQLModule } = await import("@nest-boot/graphql");
    definition.providers.push({
      provide: Symbol("JobResolver"),
      inject: [JobService, ModulesContainer, MODULE_OPTIONS_TOKEN],
      useFactory: async (
        service: InstanceType<typeof JobService> | null,
        modules: ModulesContainer,
        options: QueueModuleOptions,
      ) => {
        if (
          !service ||
          options.graphql === false ||
          ![...modules.values()].some(
            (module) => module.metatype === GraphQLModule,
          )
        )
          return null;
        if (!isAvailable("@nest-boot/graphql-connection")) {
          throw new Error(
            "Queue GraphQL queries require @nest-boot/graphql-connection",
          );
        }
        const { JobResolver } = await import("./resolvers/job.resolver.js");
        return new JobResolver(service);
      },
    });
  }
  return definition;
}
