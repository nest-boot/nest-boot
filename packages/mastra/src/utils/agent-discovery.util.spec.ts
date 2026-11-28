import { Agent as MastraAgent } from "@mastra/core/agent";
import { RequestContext as MastraRequestContext } from "@mastra/core/request-context";
import { createTool } from "@mastra/core/tools";
import { Can, CAN_METADATA } from "@nest-boot/auth";
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from "@nestjs/common";
import { z } from "zod";

const authMocks = vi.hoisted(() => ({
  getAuthAbility: vi.fn<() => object>(() => {
    throw new UnauthorizedException("Unauthenticated");
  }),
  can: vi.fn<(action: string, subject: unknown) => boolean>(() => false),
}));

vi.mock("@nest-boot/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nest-boot/auth")>();
  return {
    ...actual,
    getAuthAbility: authMocks.getAuthAbility,
    can: authMocks.can,
  };
});

import { BaseAgent } from "../agents/base.agent.js";
import { BaseTool } from "../tools/base.tool.js";
import { BaseWorkflow } from "../workflows/base.workflow.js";
import {
  canDiscoverMastraPrimitive,
  concealToolInstanceDependencies,
  isMastraToolInstance,
  wrapAgentDiscovery,
} from "./agent-discovery.util.js";

class Article {
  constructor(
    readonly id: string,
    readonly tenant: string,
  ) {}
}

class BillingLedger {}
class RefundOrder {}

describe("agent-discovery.util", () => {
  beforeEach(() => {
    authMocks.getAuthAbility.mockReset();
    authMocks.can.mockReset();
    authMocks.getAuthAbility.mockImplementation(() => {
      throw new UnauthorizedException("Unauthenticated");
    });
    authMocks.can.mockReturnValue(false);
  });

  it("identifies Mastra tools and conceals non-Mastra DI properties without touching plain functional tools", () => {
    expect(isMastraToolInstance(null)).toBe(false);
    expect(isMastraToolInstance("not-a-tool")).toBe(false);

    const functionalTool = createTool({
      id: "plain-functional",
      description: "Functional tool",
      execute: () => Promise.resolve({ ok: true }),
    });
    expect(isMastraToolInstance(functionalTool)).toBe(true);
    concealToolInstanceDependencies(null);
    concealToolInstanceDependencies(functionalTool);

    class InjectedTool extends BaseTool({
      description: "Tool with injected service",
    }) {
      readonly injectedService = { circular: true };

      execute() {
        return Promise.resolve({});
      }
    }

    const tool = new InjectedTool();
    Object.defineProperty(tool, "nonConfigurableProp", {
      value: 1,
      enumerable: true,
      configurable: false,
    });
    concealToolInstanceDependencies(tool);

    expect(Object.keys({ ...tool })).not.toContain("injectedService");
    expect(Object.keys({ ...tool })).toContain("nonConfigurableProp");
  });

  it("evaluates static, stacked, undefined-subject, null-prototype, and sync/async callback @Can requirements", async () => {
    expect(await canDiscoverMastraPrimitive(null)).toBe(true);

    const nullProtoStructuralTool = Object.assign(
      Object.create(null) as object,
      {
        id: "null-proto-tool",
        description: "Null-prototype structural tool",
        execute: () => Promise.resolve({ ok: true }),
      },
    );
    expect(await canDiscoverMastraPrimitive(nullProtoStructuralTool)).toBe(
      true,
    );

    class MethodLevelCanTool extends BaseTool({
      description: "Invalid method-level @Can",
    }) {
      @Can("read", Article)
      execute() {
        return Promise.resolve({});
      }
    }
    await expect(
      canDiscoverMastraPrimitive(new MethodLevelCanTool()),
    ).rejects.toThrow(/declares @Can\(\.\.\.\) on execute\(\)/);

    @Can("read", Article)
    @Can("update", Article)
    class StackedCanTool extends BaseTool({
      description: "Requires read + update",
    }) {
      execute() {
        return Promise.resolve({});
      }
    }

    class UndefinedStaticSubjectTool extends BaseTool({
      description: "Undefined static subject",
    }) {
      execute() {
        return Promise.resolve({});
      }
    }
    Reflect.defineMetadata(
      CAN_METADATA,
      [{ action: "read", subject: undefined }],
      UndefinedStaticSubjectTool,
    );

    // Unauthenticated ability -> denied without invoking callbacks
    const callbackSpy = vi.fn();
    @Can(
      "read",
      (
        _self: TenantTool,
        options?: { requestContext?: MastraRequestContext },
      ) => {
        const tenant = String(options?.requestContext?.get("tenant") ?? "none");
        callbackSpy(tenant);
        return new Article("1", tenant);
      },
    )
    class TenantTool extends BaseTool({
      description: "Tenant callback tool",
    }) {
      execute() {
        return Promise.resolve({});
      }
    }

    expect(await canDiscoverMastraPrimitive(new TenantTool())).toBe(false);
    expect(callbackSpy).not.toHaveBeenCalled();

    // Non-401/403 ability error rethrows
    authMocks.getAuthAbility.mockImplementationOnce(() => {
      throw new Error("Ability store corrupted");
    });
    await expect(canDiscoverMastraPrimitive(new TenantTool())).rejects.toThrow(
      "Ability store corrupted",
    );

    // Authenticated user
    authMocks.getAuthAbility.mockReturnValue({});
    authMocks.can.mockImplementation((action, subject) => {
      if (action === "read" && subject === Article) {
        return true;
      }
      if (
        action === "read" &&
        subject instanceof Article &&
        subject.tenant === "acme"
      ) {
        return true;
      }
      return false;
    });

    expect(await canDiscoverMastraPrimitive(new StackedCanTool())).toBe(false);
    expect(
      await canDiscoverMastraPrimitive(new UndefinedStaticSubjectTool()),
    ).toBe(false);

    const acmeCtx = new MastraRequestContext();
    acmeCtx.set("tenant", "acme");
    expect(
      await canDiscoverMastraPrimitive(new TenantTool(), {
        requestContext: acmeCtx,
      }),
    ).toBe(true);
    expect(callbackSpy).toHaveBeenCalledWith("acme");

    @Can("read", () => {
      throw new ForbiddenException("Denied");
    })
    class SyncForbiddenTool extends BaseTool({ description: "403" }) {
      execute() {
        return Promise.resolve({});
      }
    }
    expect(await canDiscoverMastraPrimitive(new SyncForbiddenTool())).toBe(
      false,
    );

    @Can("read", () => {
      throw new HttpException("Teapot", HttpStatus.I_AM_A_TEAPOT);
    })
    class SyncHttpTeapotTool extends BaseTool({ description: "418" }) {
      execute() {
        return Promise.resolve({});
      }
    }
    await expect(
      canDiscoverMastraPrimitive(new SyncHttpTeapotTool()),
    ).rejects.toThrow("Teapot");

    @Can("read", () => Promise.resolve(undefined as never))
    class AsyncUndefinedSubjectTool extends BaseTool({
      description: "Async undefined subject",
    }) {
      execute() {
        return Promise.resolve({});
      }
    }
    expect(
      await canDiscoverMastraPrimitive(new AsyncUndefinedSubjectTool()),
    ).toBe(false);
  });

  it("wraps listTools, sync/async listAgents, listWorkflows, listToolsets, listClientTools, getDefaultOptions, and __fork safely", async () => {
    authMocks.getAuthAbility.mockReturnValue({});
    authMocks.can.mockImplementation(
      (action, subject) =>
        (action === "manage" && subject === BillingLedger) ||
        (action === "read" && subject instanceof Article),
    );

    class PublicTool extends BaseTool({ description: "Public" }) {
      execute() {
        return Promise.resolve({});
      }
    }

    @Can("create", RefundOrder)
    class RestrictedTool extends BaseTool({ description: "Restricted" }) {
      execute() {
        return Promise.resolve({});
      }
    }

    @Can("read", () => Promise.resolve(new Article("a-1", "acme")))
    class AsyncAllowedTool extends BaseTool({ description: "Async allowed" }) {
      execute() {
        return Promise.resolve({});
      }
    }

    @Can("read", () =>
      Promise.reject(new HttpException("Denied 403", HttpStatus.FORBIDDEN)),
    )
    class AsyncDeniedTool extends BaseTool({ description: "Async denied" }) {
      execute() {
        return Promise.resolve({});
      }
    }

    @Can("read", () => Promise.reject(new RangeError("Async bug")))
    class AsyncBugTool extends BaseTool({ description: "Async bug" }) {
      execute() {
        return Promise.resolve({});
      }
    }

    @Can("read", () => {
      throw new TypeError("Sync bug");
    })
    class SyncBugTool extends BaseTool({ description: "Sync bug" }) {
      execute() {
        return Promise.resolve({});
      }
    }

    @Can("manage", BillingLedger)
    class AllowedSubAgent extends BaseAgent {
      constructor() {
        super({
          name: "Allowed SubAgent",
          instructions: "Allowed",
          model: "openai/gpt-4o-mini",
        });
      }
    }

    @Can("create", RefundOrder)
    class DeniedWorkflow extends BaseWorkflow({
      inputSchema: z.object({ a: z.number() }),
      outputSchema: z.object({ a: z.number() }),
    }) {}

    const publicTool = new PublicTool();
    const restrictedTool = new RestrictedTool();
    const allowedSubAgent = new AllowedSubAgent();
    const deniedWorkflow = new DeniedWorkflow();

    const supervisor = new MastraAgent({
      id: "supervisor",
      name: "Supervisor",
      instructions: "Coordinate",
      model: "openai/gpt-4o-mini",
      tools: {
        publicTool,
        restrictedTool,
        asyncAllowed: new AsyncAllowedTool(),
        asyncDenied: new AsyncDeniedTool(),
      },
      agents: {
        allowedSubAgent,
      },
      workflows: {
        deniedWorkflow,
      },
      defaultOptions: {
        maxSteps: 2,
        toolsets: {
          extra: {
            publicTool,
            restrictedTool,
          },
        },
        clientTools: {
          publicTool,
          restrictedTool,
        },
      },
    });

    wrapAgentDiscovery(supervisor);
    // Idempotent second call
    wrapAgentDiscovery(supervisor);

    // Sync listAgents preserved
    const syncAgents = supervisor.listAgents();
    expect(syncAgents).not.toBeInstanceOf(Promise);
    expect(Object.getPrototypeOf(syncAgents)).toBeNull();
    expect(Object.keys(syncAgents)).toEqual(["allowedSubAgent"]);

    const tools = await supervisor.listTools();
    expect(Object.keys(tools)).toEqual(["publicTool", "asyncAllowed"]);
    expect(Object.keys(await supervisor.listWorkflows())).toEqual([]);

    // Default options filtered
    const resolvedDefaults = (await supervisor.getDefaultOptions()) as {
      maxSteps: number;
      toolsets: { extra: Record<string, unknown> };
      clientTools: Record<string, unknown>;
    };
    expect(resolvedDefaults.maxSteps).toBe(2);
    expect(Object.keys(resolvedDefaults.toolsets.extra)).toEqual([
      "publicTool",
    ]);
    expect(Object.keys(resolvedDefaults.clientTools)).toEqual(["publicTool"]);

    // Plain defaultOptions stays synchronous
    const plainAgent = new MastraAgent({
      id: "plain-agent",
      name: "Plain",
      instructions: "Plain",
      model: "openai/gpt-4o-mini",
      defaultOptions: { maxSteps: 4 },
    });
    wrapAgentDiscovery(plainAgent);
    expect(plainAgent.getDefaultOptions()).toEqual({ maxSteps: 4 });

    // Async defaultOptions function
    const asyncDefaultsAgent = new MastraAgent({
      id: "async-defaults-agent",
      name: "Async Defaults",
      instructions: "Async Defaults",
      model: "openai/gpt-4o-mini",
      defaultOptions: () =>
        Promise.resolve({
          toolsets: { setA: { publicTool, restrictedTool } },
        }),
    });
    wrapAgentDiscovery(asyncDefaultsAgent);
    const asyncDefaults = (await asyncDefaultsAgent.getDefaultOptions()) as {
      toolsets: { setA: Record<string, unknown> };
    };
    expect(Object.keys(asyncDefaults.toolsets.setA)).toEqual(["publicTool"]);

    // Direct listToolsets / listClientTools calls (with & without field)
    const internalAgent = supervisor as unknown as {
      listToolsets: (params: Record<string, unknown>) => Promise<object>;
      listClientTools: (params: Record<string, unknown>) => Promise<object>;
      __fork: () => MastraAgent;
    };
    const mockModel = {
      specificationVersion: "v2",
      provider: "mock",
      modelId: "mock",
    };
    expect(
      Object.keys(
        await internalAgent.listToolsets({
          toolsets: { setA: { publicTool, restrictedTool } },
          getModel: () => Promise.resolve(mockModel),
        }),
      ),
    ).toEqual(["publicTool"]);
    expect(
      Object.keys(
        await internalAgent.listToolsets({
          getModel: () => Promise.resolve(mockModel),
        }),
      ),
    ).toEqual([]);
    expect(
      Object.keys(
        await internalAgent.listClientTools({
          clientTools: { publicTool, restrictedTool },
          model: mockModel,
          getModel: () => Promise.resolve(mockModel),
        }),
      ),
    ).toEqual(["publicTool"]);

    // __fork preserves source metadata
    const forkedAllowed = (
      allowedSubAgent as unknown as { __fork: () => MastraAgent }
    ).__fork();
    expect(await canDiscoverMastraPrimitive(forkedAllowed)).toBe(true);

    // Sync throw following async rejection does not trigger unhandledRejection
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      const mixedFailureAgent = new MastraAgent({
        id: "mixed-failure",
        name: "Mixed Failure",
        instructions: "Mixed",
        model: "openai/gpt-4o-mini",
        tools: {
          firstAsync: new AsyncBugTool(),
          secondSync: new SyncBugTool(),
        },
      });
      wrapAgentDiscovery(mixedFailureAgent);
      await expect(mixedFailureAgent.listTools()).rejects.toThrow("Sync bug");
      await new Promise((resolve) => setImmediate(resolve));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});
