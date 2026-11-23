import { Agent as MastraAgent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import {
  type AnyWorkflow,
  Workflow as MastraWorkflow,
} from "@mastra/core/workflows";
import {
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";

/**
 * Discovers singleton NestJS providers extending Mastra `Agent` (including `BaseAgent`)
 * and Mastra `Workflow` (including `BaseWorkflow`) across all loaded modules and
 * registers them into the shared `Mastra` instance.
 */
@Injectable()
export class MastraManager implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(MastraManager.name);
  private readonly agents = new Map<string, MastraAgent>();
  private readonly workflows = new Map<string, AnyWorkflow>();
  private initialized = false;
  private shutDown = false;

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly mastra: Mastra,
  ) {}

  /**
   * Scans NestJS providers and registers all discovered singleton Mastra agents and workflows.
   */
  onModuleInit(): void {
    if (this.initialized) {
      return;
    }

    for (const agent of Object.values(this.mastra.listAgents())) {
      if (agent instanceof MastraAgent) {
        this.agents.set(agent.id, agent);
      }
    }

    for (const workflow of Object.values(this.mastra.listWorkflows())) {
      if (workflow instanceof MastraWorkflow) {
        this.workflows.set(workflow.id, workflow);
      }
    }

    for (const provider of this.discovery.getProviders()) {
      if (provider.isAlias) {
        continue;
      }

      const instance: unknown = provider.instance;
      const target =
        !provider.metatype || provider.inject
          ? (instance?.constructor ??
            (typeof provider.token === "function" ? provider.token : undefined))
          : provider.metatype;

      if (!target) {
        continue;
      }

      const isAgent =
        instance instanceof MastraAgent ||
        (typeof target === "function" &&
          target.prototype instanceof MastraAgent);
      const isWorkflow =
        instance instanceof MastraWorkflow ||
        (typeof target === "function" &&
          target.prototype instanceof MastraWorkflow);

      if (!isAgent && !isWorkflow) {
        continue;
      }

      if (isAgent) {
        if (
          !provider.isDependencyTreeStatic() ||
          provider.isTransient ||
          !(instance instanceof MastraAgent)
        ) {
          throw new Error(
            `Agent "${target.name}" must be a singleton Mastra Agent provider.`,
          );
        }

        const previous = this.agents.get(instance.id);
        if (previous) {
          if (previous === instance) {
            continue;
          }
          throw new Error(
            `Mastra agent "${String(instance.id)}" has multiple providers (${previous.constructor.name} and ${instance.constructor.name}). Use a unique agent id or reuse a single provider.`,
          );
        }

        this.mastra.addAgent(instance);
        this.agents.set(instance.id, instance);

        this.logger.log(
          `Registered Mastra agent "${String(instance.id)}" (${instance.constructor.name})`,
        );
        continue;
      }

      if (
        !provider.isDependencyTreeStatic() ||
        provider.isTransient ||
        !(instance instanceof MastraWorkflow)
      ) {
        throw new Error(
          `Workflow "${target.name}" must be a singleton Mastra Workflow provider.`,
        );
      }

      const previous = this.workflows.get(instance.id);
      if (previous) {
        if (previous === instance) {
          continue;
        }
        throw new Error(
          `Mastra workflow "${String(instance.id)}" has multiple providers (${previous.constructor.name} and ${instance.constructor.name}). Use a unique workflow id or reuse a single provider.`,
        );
      }

      this.mastra.addWorkflow(instance);
      this.workflows.set(instance.id, instance);

      this.logger.log(
        `Registered Mastra workflow "${String(instance.id)}" (${instance.constructor.name})`,
      );
    }

    this.initialized = true;
  }

  /**
   * Returns all discovered and registered Mastra agents.
   * @returns Array of registered Mastra agent instances
   */
  getAgents(): MastraAgent[] {
    this.onModuleInit();
    return [...this.agents.values()];
  }

  /**
   * Looks up a registered Mastra agent by its id.
   * @param id - Agent id
   * @returns Matching agent instance or undefined
   */
  getAgent(id: string): MastraAgent | undefined {
    this.onModuleInit();
    return this.agents.get(id);
  }

  /**
   * Returns all discovered and registered Mastra workflows.
   * @returns Array of registered Mastra workflow instances
   */
  getWorkflows(): AnyWorkflow[] {
    this.onModuleInit();
    return [...this.workflows.values()];
  }

  /**
   * Looks up a registered Mastra workflow by its id.
   * @param id - Workflow id
   * @returns Matching workflow instance or undefined
   */
  getWorkflow(id: string): AnyWorkflow | undefined {
    this.onModuleInit();
    return this.workflows.get(id);
  }

  /**
   * Flushes observability exporters and releases underlying storage handles
   * (such as PostgreSQL connection pools) when the Nest application shuts down.
   */
  async onApplicationShutdown(): Promise<void> {
    if (this.shutDown) {
      return;
    }

    this.shutDown = true;
    await this.mastra.shutdown();
  }
}
