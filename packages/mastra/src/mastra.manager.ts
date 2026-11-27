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
  Optional,
} from "@nestjs/common";
import {
  ApplicationConfig,
  DiscoveryService,
  ExternalContextCreator,
} from "@nestjs/core";
import type { InstanceWrapper } from "@nestjs/core/injector/instance-wrapper.js";

import { type AnyMastraTool, BaseTool } from "./base.tool.js";
import {
  bindToolGuards,
  canExposeMastraTool,
  concealToolInstanceDependencies,
  isClassBasedMastraTool,
  isMastraToolInstance,
  unbindAgentToolDiscovery,
  unbindToolGuards,
  wrapAgentToolDiscovery,
} from "./tool-guard.js";

/**
 * Discovers singleton NestJS providers extending Mastra `Tool` (including `BaseTool`),
 * Mastra `Agent` (including `BaseAgent`), and Mastra `Workflow` (including `BaseWorkflow`)
 * across all loaded modules, binds NestJS execution and exposure-filtering guards onto tools,
 * and registers them into the shared `Mastra` instance.
 */
@Injectable()
export class MastraManager implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(MastraManager.name);
  private readonly trackedTools = new WeakSet<AnyMastraTool>();
  private readonly boundToolRefs = new Set<WeakRef<AnyMastraTool>>();
  private readonly boundToolCleanup = new FinalizationRegistry<
    WeakRef<AnyMastraTool>
  >((ref) => {
    this.boundToolRefs.delete(ref);
  });
  private readonly boundAgents = new Set<MastraAgent>();
  private readonly agents = new Map<string, MastraAgent>();
  private readonly workflows = new Map<string, AnyWorkflow>();
  private bindAdHocToolFn?: (tool: AnyMastraTool) => void;
  private restoreMastraRegistrationHooks?: () => void;
  private initialized = false;
  private shutDown = false;

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly mastra: Mastra,
    @Optional()
    private readonly externalContextCreator?: ExternalContextCreator,
    @Optional()
    private readonly applicationConfig?: ApplicationConfig,
  ) {}

  /**
   * Scans NestJS providers and registers all discovered singleton Mastra tools, agents, and workflows.
   */
  onModuleInit(): void {
    if (this.initialized) {
      return;
    }

    const bindAdHocTool = (tool: AnyMastraTool): void => {
      concealToolInstanceDependencies(tool);
      if (!this.externalContextCreator) {
        return;
      }
      bindToolGuards(tool, this.externalContextCreator, {
        applicationConfig: this.applicationConfig,
      });
      this.trackBoundTool(tool);
    };

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

      // 1. Register & bind discovered Tool providers first so their module context is preserved
      // even when also referenced by preconfigured agents or Mastra options.
      const preconfiguredToolsRecord = this.mastra.listTools() ?? {};
      const preconfiguredMastraTools = Object.values(preconfiguredToolsRecord);
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

        const preconfiguredIdMatch = preconfiguredMastraTools.find(
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

        if (this.externalContextCreator) {
          bindToolGuards(instance, this.externalContextCreator, {
            wrapper: provider,
            moduleRef: provider.host,
            applicationConfig: this.applicationConfig,
          });
          this.trackBoundTool(instance);
        }

        if (!preconfiguredKeyMatch && !preconfiguredIdMatch) {
          this.mastra.addTool(instance);
        }
        seenProviderTools.set(instance.id, instance);

        this.logger.log(
          `Registered Mastra tool "${String(instance.id)}" (${instance.constructor.name})`,
        );
      }

      this.syncMastraToolsRegistry(bindAdHocTool);

      // 2. Register & wrap preconfigured and discovered Agents.
      for (const agent of Object.values(this.mastra.listAgents())) {
        if (agent instanceof MastraAgent) {
          wrapAgentToolDiscovery(agent, {
            bindUnboundTool: bindAdHocTool,
            externalContextCreator: this.externalContextCreator,
          });
          this.boundAgents.add(agent);
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

        wrapAgentToolDiscovery(instance, {
          bindUnboundTool: bindAdHocTool,
          externalContextCreator: this.externalContextCreator,
        });
        this.boundAgents.add(instance);
        this.mastra.addAgent(instance);
        this.agents.set(instance.id, instance);

        this.logger.log(
          `Registered Mastra agent "${String(instance.id)}" (${instance.constructor.name})`,
        );
      }

      // Bind any ad-hoc class-based tools that `mastra.addAgent(...)` added into Mastra.
      this.syncMastraToolsRegistry(bindAdHocTool);

      // 3. Register preconfigured and discovered Workflows.
      for (const workflow of Object.values(this.mastra.listWorkflows())) {
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

      this.bindAdHocToolFn = bindAdHocTool;
      this.installMastraRegistrationHooks(bindAdHocTool);
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
      this.releaseBoundPrimitives();
      throw error;
    }
  }

  private installMastraRegistrationHooks(
    bindAdHocTool: (tool: AnyMastraTool) => void,
  ): void {
    const originalAddTool = this.mastra.addTool.bind(this.mastra);
    const originalAddAgent = this.mastra.addAgent.bind(this.mastra);

    this.mastra.addTool = ((tool: AnyMastraTool, key?: string) => {
      if (isClassBasedMastraTool(tool)) {
        bindAdHocTool(tool);
      }
      originalAddTool(tool, key);
    }) as typeof this.mastra.addTool;

    this.mastra.addAgent = ((
      agent: Parameters<Mastra["addAgent"]>[0],
      key?: Parameters<Mastra["addAgent"]>[1],
      options?: Parameters<Mastra["addAgent"]>[2],
    ) => {
      if (agent instanceof MastraAgent) {
        wrapAgentToolDiscovery(agent, {
          bindUnboundTool: bindAdHocTool,
          externalContextCreator: this.externalContextCreator,
        });
        this.boundAgents.add(agent);
      }
      originalAddAgent(agent, key, options);
      if (agent instanceof MastraAgent) {
        this.agents.set(agent.id, agent);
      }
      this.syncMastraToolsRegistry(bindAdHocTool);
    }) as typeof this.mastra.addAgent;

    this.restoreMastraRegistrationHooks = () => {
      this.mastra.addTool = originalAddTool;
      this.mastra.addAgent = originalAddAgent;
    };
  }

  private ensureToolBound(tool: AnyMastraTool | undefined): void {
    if (tool && isClassBasedMastraTool(tool)) {
      this.bindAdHocToolFn?.(tool);
    }
  }

  private trackBoundTool(tool: AnyMastraTool): void {
    if (this.trackedTools.has(tool)) {
      return;
    }
    this.trackedTools.add(tool);
    const ref = new WeakRef(tool);
    this.boundToolRefs.add(ref);
    this.boundToolCleanup.register(tool, ref, ref);
  }

  private releaseBoundPrimitives(): void {
    this.restoreMastraRegistrationHooks?.();
    this.restoreMastraRegistrationHooks = undefined;
    this.bindAdHocToolFn = undefined;

    for (const ref of this.boundToolRefs) {
      this.boundToolCleanup.unregister(ref);
      const tool = ref.deref();
      if (tool) {
        this.trackedTools.delete(tool);
        unbindToolGuards(tool, this.externalContextCreator);
      }
    }
    this.boundToolRefs.clear();

    for (const agent of this.boundAgents) {
      unbindAgentToolDiscovery(agent, this.externalContextCreator);
    }
    this.boundAgents.clear();
  }

  private syncMastraToolsRegistry(
    bindAdHocTool: (tool: AnyMastraTool) => void,
  ): void {
    for (const tool of Object.values(this.mastra.listTools() ?? {})) {
      if (isClassBasedMastraTool(tool)) {
        bindAdHocTool(tool);
      }
    }
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
        this.ensureToolBound(tool);
        uniqueTools.add(tool);
      }
    }
    return [...uniqueTools];
  }

  /**
   * Looks up a registered Mastra tool by its exact live registry map key (`mastra.listTools()[key]`).
   * @param key - Registration key in Mastra's tools record
   * @returns Matching tool instance or undefined
   */
  getToolByRegistrationKey(key: string): AnyMastraTool | undefined {
    this.onModuleInit();
    const liveTools = this.mastra.listTools();
    if (!liveTools || !Object.hasOwn(liveTools, key)) {
      return undefined;
    }
    const fromMastra = liveTools[key];
    if (isMastraToolInstance(fromMastra)) {
      this.ensureToolBound(fromMastra);
      return fromMastra;
    }
    return undefined;
  }

  /**
   * Looks up a registered Mastra tool using the same precedence as Mastra's server routes:
   * intrinsic `tool.id` first, then registration key.
   * @param id - Tool id or registration key
   * @returns Matching tool instance or undefined
   */
  getTool(id: string): AnyMastraTool | undefined {
    this.onModuleInit();
    try {
      const byMastraLookup = this.mastra.getToolById(id);
      if (isMastraToolInstance(byMastraLookup)) {
        this.ensureToolBound(byMastraLookup);
        return byMastraLookup;
      }
    } catch {
      // Mastra throws when a tool ID is not registered.
    }
    return undefined;
  }

  /**
   * Checks whether a registered tool or tool instance can be exposed in the current context.
   * @param idOrTool - Tool id, registration key, or tool instance
   * @returns `true` when the tool exists and passes exposure-time guards
   */
  async canAccessTool(idOrTool: string | AnyMastraTool): Promise<boolean> {
    this.onModuleInit();
    const tool =
      typeof idOrTool === "string" ? this.getTool(idOrTool) : idOrTool;
    if (!tool) {
      return false;
    }
    this.ensureToolBound(tool);
    return await canExposeMastraTool(tool);
  }

  /**
   * Returns all registered Mastra tools accessible to the current caller.
   * @returns Array of accessible Mastra tool instances
   */
  async getAccessibleTools(): Promise<AnyMastraTool[]> {
    const allTools = this.getTools();
    const checks = await Promise.all(
      allTools.map(async (tool) => ({
        tool,
        allowed: await canExposeMastraTool(tool),
      })),
    );
    return checks.filter((entry) => entry.allowed).map((entry) => entry.tool);
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
   * Drains Mastra runs, flushes observability exporters, closes underlying storage handles,
   * and then releases container guard bindings on bound tools and agents.
   */
  async onApplicationShutdown(): Promise<void> {
    if (this.shutDown) {
      return;
    }

    this.shutDown = true;
    try {
      await this.mastra.shutdown();
    } finally {
      this.releaseBoundPrimitives();
    }
  }
}
