import { Global, Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import { createJobProviders } from "./job.providers.js";
import { QueueHealthIndicator } from "./queue.health-indicator.js";
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./queue.module-definition.js";
import { QueueRegistrar } from "./queue.registrar.js";

const jobProviders = await createJobProviders();

/**
 * BullMQ integration module for job queue processing.
 *
 * Uses the official PostgreSQL backend, configured by QUEUE_DATABASE_URL or DATABASE_URL.
 * Registers read-only JobService queries when DatabaseModule and Job metadata are available.
 * Enables GraphQL job queries when GraphQLModule is registered unless graphql is false.
 */
@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [
    { provide: MODULE_OPTIONS_TOKEN, useValue: {} },
    QueueRegistrar,
    QueueHealthIndicator,
    ...jobProviders.providers,
  ],
  exports: [
    MODULE_OPTIONS_TOKEN,
    QueueHealthIndicator,
    ...jobProviders.exports,
  ],
})
export class QueueModule extends ConfigurableModuleClass {}
