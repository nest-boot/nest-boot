import { Agent as MastraAgent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { Tool as MastraTool } from "@mastra/core/tools";
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
import type { InstanceWrapper } from "@nestjs/core/injector/instance-wrapper.js";

import { BaseTool } from "./tools/base.tool.js";
import type { AnyMastraTool } from "./types/tool.type.js";
import {
  concealToolInstanceDependencies,
  isMastraToolInstance,
  wrapAgentDiscovery,
} from "./utils/agent-discovery.util.js";

/**
 * Discovers singleton NestJS providers extending Mastra `Tool` (`BaseTool`),
 * `Agent` (`BaseAgent`), and `Workflow` (`BaseWorkflow`) across all loaded modules,
 * registers them into the shared `Mastra` instance, and enables `@Can(...)` discovery
 * filtering on registered agents.
 */
@Injectable()
export class MastraManager implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(MastraManager.name);
  private readonly agents = new Map<string, MastraAgent>();
  private readonly workflows = new Map<string, AnyWorkflow>();
  private restoreMastraRegistrationHooks?: () => void;
  private initialized = false;
  private shutDown = false;

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly mastra: Mastra,
  ) {}

  /**
   * Scans NestJS providers and registers all discovered singleton Mastra tools, agents, and workflows.
   */
  onModuleInit(): void {
    if (this.initialized) {
      return;
    }

    const initialToolKeys = new Set(Object.keys(this.mastra.listTools() ?? {}));
    const initialAgentKeys = new Set(
      Object.keys(this.mastra.listAgents() ?? {}),
    );
    const initialWorkflowKeys = new Set(
      Object.keys(this.mastra.listWorkflows() ?? {}),
    );

    try {
      const toolProviders: {
        provider: InstanceWrapper;
        target: abstract new (...args: never[]) => unknown;
      }[] = [];
      const agentProviders: {
        provider: InstanceWrapper;
        target: abstract new (...args: never[]) => unknown;
      }[] = [];
      const workflowProviders: {
        provider: InstanceWrapper;
        target: abstract new (...args: never[]) => unknown;
      }[] = [];

      for (const provider of this.discovery.getProviders()) {
        if (provider.isAlias) {
          continue;
        }

        const instance: unknown = provider.instance;
        const target = (
          !provider.metatype || provider.inject
            ? (instance?.constructor ??
              (typeof provider.token === "function"
                ? provider.token
                : undefined))
            : provider.metatype
        ) as (abstract new (...args: never[]) => unknown) | undefined;

        if (!target) {
          continue;
        }

        const isTool =
          isMastraToolInstance(instance) ||
          instance instanceof BaseTool ||
          (typeof target === "function" &&
            target.prototype instanceof MastraTool);
        if (isTool) {
          toolProviders.push({ provider, target });
          continue;
        }

        const isAgent =
          instance instanceof MastraAgent ||
          (typeof target === "function" &&
            target.prototype instanceof MastraAgent);
        if (isAgent) {
          agentProviders.push({ provider, target });
          continue;
        }

        const isWorkflow =
          instance instanceof MastraWorkflow ||
          (typeof target === "function" &&
            target.prototype instanceof MastraWorkflow);
        if (isWorkflow) {
          workflowProviders.push({ provider, target });
        }
      }

      // 1. Conceal DI properties on preconfigured tools and register discovered Tool providers.
      const preconfiguredToolsRecord = this.mastra.listTools() ?? {};
      const preconfiguredTools = Object.values(preconfiguredToolsRecord);
      for (const tool of preconfiguredTools) {
        concealToolInstanceDependencies(tool);
      }

      const seenProviderTools = new Map<string, AnyMastraTool>();
      for (const { provider, target } of toolProviders) {
        const instance: unknown = provider.instance;
        if (
          !provider.isDependencyTreeStatic() ||
          provider.isTransient ||
          !isMastraToolInstance(instance)
        ) {
          throw new Error(
            `Tool "${target.name}" must be a singleton Mastra Tool provider.`,
          );
        }

        const previous = seenProviderTools.get(instance.id);
        if (previous) {
          if (previous === instance) {
            continue;
          }
          throw new Error(
            `Mastra tool "${String(instance.id)}" has multiple providers (${previous.constructor.name} and ${instance.constructor.name}). Use a unique tool id or reuse a single provider.`,
          );
        }

        const preconfiguredIdMatch = preconfiguredTools.find(
          (candidate) =>
            isMastraToolInstance(candidate) && candidate.id === instance.id,
        );
        if (preconfiguredIdMatch && preconfiguredIdMatch !== instance) {
          throw new Error(
            `Mastra tool "${String(instance.id)}" has multiple providers (${preconfiguredIdMatch.constructor.name} and ${instance.constructor.name}). Use a unique tool id or reuse a single provider.`,
          );
        }

        const preconfiguredKeyMatch = preconfiguredToolsRecord[instance.id];
        if (preconfiguredKeyMatch && preconfiguredKeyMatch !== instance) {
          throw new Error(
            `Mastra tool "${String(instance.id)}" (${instance.constructor.name}) collides with an existing tool registered under key "${String(instance.id)}". Use a unique tool id or registration key.`,
          );
        }

        concealToolInstanceDependencies(instance);
        seenProviderTools.set(instance.id, instance);

        if (!preconfiguredIdMatch) {
          this.mastra.addTool(instance);
        }

        this.logger.log(
          `Registered Mastra tool "${String(instance.id)}" (${instance.constructor.name})`,
        );
      }

      // 2. Wrap preconfigured Agents and register discovered Agent providers.
      for (const agent of Object.values(this.mastra.listAgents() ?? {})) {
        if (agent instanceof MastraAgent) {
          wrapAgentDiscovery(agent);
          this.agents.set(agent.id, agent);
        }
      }

      for (const { provider, target } of agentProviders) {
        const instance: unknown = provider.instance;
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

        wrapAgentDiscovery(instance);
        this.mastra.addAgent(instance);
        this.agents.set(instance.id, instance);

        this.logger.log(
          `Registered Mastra agent "${String(instance.id)}" (${instance.constructor.name})`,
        );
      }

      // Conceal DI fields on any tools Mastra auto-registered from agent tool maps.
      for (const tool of Object.values(this.mastra.listTools() ?? {})) {
        concealToolInstanceDependencies(tool);
      }

      // 3. Register preconfigured and discovered Workflows.
      for (const workflow of Object.values(this.mastra.listWorkflows() ?? {})) {
        if (workflow instanceof MastraWorkflow) {
          this.workflows.set(workflow.id, workflow);
        }
      }

      for (const { provider, target } of workflowProviders) {
        const instance: unknown = provider.instance;
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

      this.installMastraRegistrationHooks();
      this.initialized = true;
    } catch (error) {
      for (const key of Object.keys(this.mastra.listTools() ?? {})) {
        if (!initialToolKeys.has(key)) {
          this.mastra.removeTool(key);
        }
      }
      for (const key of Object.keys(this.mastra.listAgents() ?? {})) {
        if (!initialAgentKeys.has(key)) {
          this.mastra.removeAgent(key);
        }
      }
      for (const key of Object.keys(this.mastra.listWorkflows() ?? {})) {
        if (!initialWorkflowKeys.has(key)) {
          this.mastra.removeWorkflow(key);
        }
      }
      this.agents.clear();
      this.workflows.clear();
      throw error;
    }
  }

  private installMastraRegistrationHooks(): void {
    const originalAddTool = this.mastra.addTool.bind(this.mastra);
    const originalAddAgent = this.mastra.addAgent.bind(this.mastra);

    this.mastra.addTool = ((tool: AnyMastraTool, key?: string) => {
      concealToolInstanceDependencies(tool);
      originalAddTool(tool, key);
    }) as typeof this.mastra.addTool;

    this.mastra.addAgent = ((
      agent: Parameters<Mastra["addAgent"]>[0],
      key?: Parameters<Mastra["addAgent"]>[1],
      options?: Parameters<Mastra["addAgent"]>[2],
    ) => {
      if (agent instanceof MastraAgent) {
        wrapAgentDiscovery(agent);
      }
      originalAddAgent(agent, key, options);
      if (agent instanceof MastraAgent) {
        this.agents.set(agent.id, agent);
      }
      for (const tool of Object.values(this.mastra.listTools() ?? {})) {
        concealToolInstanceDependencies(tool);
      }
    }) as typeof this.mastra.addAgent;

    this.restoreMastraRegistrationHooks = () => {
      this.mastra.addTool = originalAddTool;
      this.mastra.addAgent = originalAddAgent;
    };
  }

  /**
   * Returns all discovered and registered Mastra tools from the live Mastra registry.
   * @returns Array of registered Mastra tool instances
   */
  getTools(): AnyMastraTool[] {
    this.onModuleInit();
    const uniqueTools = new Set<AnyMastraTool>();
    for (const tool of Object.values(this.mastra.listTools() ?? {})) {
      if (isMastraToolInstance(tool)) {
        uniqueTools.add(tool);
      }
    }
    return [...uniqueTools];
  }

  /**
   * Looks up a registered Mastra tool by its intrinsic `tool.id` or registration key.
   * @param id - Tool id or registration key
   * @returns Matching tool instance or undefined
   */
  getTool(id: string): AnyMastraTool | undefined {
    this.onModuleInit();
    try {
      const tool = this.mastra.getToolById(id);
      if (isMastraToolInstance(tool)) {
        return tool;
      }
    } catch {
      // Mastra throws when a tool ID is not registered.
    }
    return undefined;
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
   * Shuts down the underlying Mastra instance once when the NestJS application closes.
   */
  async onApplicationShutdown(): Promise<void> {
    if (this.shutDown) {
      return;
    }
    this.shutDown = true;
    this.restoreMastraRegistrationHooks?.();
    this.restoreMastraRegistrationHooks = undefined;
    await this.mastra.shutdown();
  }
}
