import { Agent as MastraAgent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { createTool } from "@mastra/core/tools";
import { Workflow as MastraWorkflow } from "@mastra/core/workflows";
import type { DiscoveryService } from "@nestjs/core";
import type { InstanceWrapper } from "@nestjs/core/injector/instance-wrapper.js";
import { z } from "zod";

import { BaseAgent } from "./agents/base.agent.js";
import { MastraManager } from "./mastra.manager.js";
import { BaseTool } from "./tools/base.tool.js";
import { BaseWorkflow } from "./workflows/base.workflow.js";

interface MockWrapperOptions {
  instance?: unknown;
  metatype?: unknown;
  token?: unknown;
  inject?: unknown[];
  isAlias?: boolean;
  isTransient?: boolean;
  isStatic?: boolean;
}

/**
 * Creates a lightweight NestJS `InstanceWrapper` test double for `MastraManager` unit tests.
 * @param options - Wrapper configuration
 * @returns Mocked `InstanceWrapper`
 */
function createWrapper(options: MockWrapperOptions): InstanceWrapper {
  return {
    instance: options.instance,
    metatype: options.metatype,
    token: options.token,
    inject: options.inject,
    isAlias: options.isAlias ?? false,
    isTransient: options.isTransient ?? false,
    isDependencyTreeStatic: () => options.isStatic ?? true,
  } as unknown as InstanceWrapper;
}

/**
 * Creates a `DiscoveryService` test double returning the supplied provider wrappers.
 * @param wrappers - Simulated NestJS provider wrappers
 * @returns Mocked `DiscoveryService`
 */
function createDiscovery(wrappers: InstanceWrapper[]): DiscoveryService {
  return {
    getProviders: () => wrappers,
  } as unknown as DiscoveryService;
}

class EchoTool extends BaseTool({
  description: "Echoes value",
  outputSchema: z.object({ ok: z.boolean() }),
}) {
  readonly injectedDep = { secret: true };

  execute() {
    return Promise.resolve({ ok: true });
  }
}

class HelperAgent extends BaseAgent {
  constructor() {
    super({
      name: "Helper Agent",
      instructions: "Assist.",
      model: "openai/gpt-4o-mini",
    });
  }
}

class SampleWorkflow extends BaseWorkflow({
  inputSchema: z.object({ v: z.number() }),
  outputSchema: z.object({ v: z.number() }),
}) {
  constructor() {
    super();
    this.commit();
  }
}

describe("MastraManager", () => {
  it("discovers singleton tools, agents, and workflows, conceals DI deps, installs runtime hooks, and shuts down idempotently", async () => {
    const preconfiguredTool = new EchoTool();
    const preconfiguredAgent = new MastraAgent({
      id: "preconfigured-agent",
      name: "Preconfigured",
      instructions: "Preconfigured",
      model: "openai/gpt-4o-mini",
    });
    const preconfiguredWorkflow = new MastraWorkflow({
      id: "preconfigured-workflow",
      inputSchema: z.object({ v: z.number() }),
      outputSchema: z.object({ v: z.number() }),
    });
    preconfiguredWorkflow.commit();

    const mastra = new Mastra({
      tools: { preconfigured: preconfiguredTool },
      agents: { "preconfigured-agent": preconfiguredAgent },
      workflows: { "preconfigured-workflow": preconfiguredWorkflow },
    });
    const shutdownSpy = vi
      .spyOn(mastra, "shutdown")
      .mockResolvedValue(undefined);

    class ExtraTool extends BaseTool({
      description: "Extra tool",
    }) {
      execute() {
        return Promise.resolve({});
      }
    }

    const extraTool = new ExtraTool();
    const helperAgent = new HelperAgent();
    const sampleWorkflow = new SampleWorkflow();

    const manager = new MastraManager(
      createDiscovery([
        createWrapper({ isAlias: true, instance: extraTool }),
        createWrapper({ instance: undefined, metatype: undefined, token: "X" }),
        createWrapper({ instance: { plain: true }, metatype: Object }),
        // Re-exported / factory provider sharing same preconfigured instance
        createWrapper({
          instance: preconfiguredTool,
          inject: [],
        }),
        createWrapper({
          instance: extraTool,
          metatype: ExtraTool,
        }),
        createWrapper({
          instance: extraTool,
          metatype: ExtraTool,
        }),
        createWrapper({
          instance: preconfiguredAgent,
          metatype: MastraAgent,
        }),
        createWrapper({
          instance: helperAgent,
          metatype: HelperAgent,
        }),
        createWrapper({
          instance: preconfiguredWorkflow,
          metatype: MastraWorkflow,
        }),
        createWrapper({
          instance: sampleWorkflow,
          metatype: SampleWorkflow,
        }),
      ]),
      mastra,
    );

    manager.onModuleInit();
    // Idempotent second call
    manager.onModuleInit();

    expect(Object.keys({ ...preconfiguredTool })).not.toContain("injectedDep");
    expect(manager.getTools()).toEqual(
      expect.arrayContaining([preconfiguredTool, extraTool]),
    );
    expect(manager.getTool("extra-tool")).toBe(extraTool);
    expect(manager.getTool("missing-tool")).toBeUndefined();
    expect(manager.getAgents()).toEqual([preconfiguredAgent, helperAgent]);
    expect(manager.getAgent("helper-agent")).toBe(helperAgent);
    expect(manager.getWorkflows()).toEqual([
      preconfiguredWorkflow,
      sampleWorkflow,
    ]);
    expect(manager.getWorkflow("sample-workflow")).toBe(sampleWorkflow);

    // Runtime mastra.addTool and mastra.addAgent hooks
    const runtimeTool = createTool({
      id: "runtime-functional-tool",
      description: "Runtime tool",
      execute: () => Promise.resolve({}),
    });
    mastra.addTool(runtimeTool);
    expect(manager.getTool("runtime-functional-tool")).toBe(runtimeTool);

    const runtimeAgent = new MastraAgent({
      id: "runtime-agent",
      name: "Runtime Agent",
      instructions: "Added dynamically",
      model: "openai/gpt-4o-mini",
    });
    mastra.addAgent(runtimeAgent);
    expect(manager.getAgent("runtime-agent")).toBe(runtimeAgent);

    await manager.onApplicationShutdown();
    await manager.onApplicationShutdown();
    expect(shutdownSpy).toHaveBeenCalledTimes(1);
  });

  it("rejects non-singleton providers, duplicate IDs, and preconfigured collisions while rolling back Mastra registrations", () => {
    // 1. Non-singleton tool (token fallback when instance is undefined)
    const nonSingletonToolMastra = new Mastra();
    const nonSingletonToolMgr = new MastraManager(
      createDiscovery([
        createWrapper({
          instance: undefined,
          token: EchoTool,
          isStatic: false,
        }),
      ]),
      nonSingletonToolMastra,
    );
    expect(() => {
      nonSingletonToolMgr.onModuleInit();
    }).toThrow(/Tool "EchoTool" must be a singleton Mastra Tool provider/);

    // 2. Duplicate tool provider ID
    class DupToolA extends BaseTool({ id: "dup-tool", description: "A" }) {
      execute() {
        return Promise.resolve({});
      }
    }
    class DupToolB extends BaseTool({ id: "dup-tool", description: "B" }) {
      execute() {
        return Promise.resolve({});
      }
    }
    expect(() => {
      new MastraManager(
        createDiscovery([
          createWrapper({ instance: new DupToolA(), metatype: DupToolA }),
          createWrapper({ instance: new DupToolB(), metatype: DupToolB }),
        ]),
        new Mastra(),
      ).onModuleInit();
    }).toThrow(/Mastra tool "dup-tool" has multiple providers/);

    // 3. Preconfigured tool ID collision
    expect(() => {
      new MastraManager(
        createDiscovery([
          createWrapper({ instance: new DupToolB(), metatype: DupToolB }),
        ]),
        new Mastra({ tools: { someKey: new DupToolA() } }),
      ).onModuleInit();
    }).toThrow(/Mastra tool "dup-tool" has multiple providers/);

    // 4. Preconfigured tool registration key collision
    const otherTool = createTool({
      id: "other-intrinsic-id",
      description: "Other",
      execute: () => Promise.resolve({}),
    });
    expect(() => {
      new MastraManager(
        createDiscovery([
          createWrapper({ instance: new DupToolA(), metatype: DupToolA }),
        ]),
        new Mastra({ tools: { "dup-tool": otherTool } }),
      ).onModuleInit();
    }).toThrow(
      /collides with an existing tool registered under key "dup-tool"/,
    );

    // 5. Partial tool + agent + workflow registrations roll back when a later provider fails
    const rollbackMastra = new Mastra();
    const validTool = new EchoTool();
    const validAgent = new HelperAgent();
    const validWorkflow = new SampleWorkflow();

    expect(() => {
      new MastraManager(
        createDiscovery([
          createWrapper({ instance: validTool, metatype: EchoTool }),
          createWrapper({ instance: validAgent, metatype: HelperAgent }),
          createWrapper({ instance: validWorkflow, metatype: SampleWorkflow }),
          createWrapper({
            instance: new SampleWorkflow(),
            metatype: SampleWorkflow,
          }),
        ]),
        rollbackMastra,
      ).onModuleInit();
    }).toThrow(/Mastra workflow "sample-workflow" has multiple providers/);

    expect(Object.keys(rollbackMastra.listTools() ?? {})).toEqual([]);
    expect(Object.keys(rollbackMastra.listAgents() ?? {})).toEqual([]);
    expect(Object.keys(rollbackMastra.listWorkflows() ?? {})).toEqual([]);

    // 6. Non-singleton agent and workflow
    expect(() => {
      new MastraManager(
        createDiscovery([
          createWrapper({
            instance: validAgent,
            metatype: HelperAgent,
            isTransient: true,
          }),
        ]),
        new Mastra(),
      ).onModuleInit();
    }).toThrow(/Agent "HelperAgent" must be a singleton Mastra Agent provider/);

    expect(() => {
      new MastraManager(
        createDiscovery([
          createWrapper({
            instance: validWorkflow,
            metatype: SampleWorkflow,
            isTransient: true,
          }),
        ]),
        new Mastra(),
      ).onModuleInit();
    }).toThrow(
      /Workflow "SampleWorkflow" must be a singleton Mastra Workflow provider/,
    );
  });
});
