import { Agent as MastraAgent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { RequestContext as MastraRequestContext } from "@mastra/core/request-context";
import { createTool } from "@mastra/core/tools";
import {
  AuthContext,
  AuthModule,
  Can,
  CAN_METADATA,
  Session,
  User,
} from "@nest-boot/auth";
import {
  type CallHandler,
  type DynamicModule,
  type ExecutionContext,
  Global,
  HttpException,
  HttpStatus,
  Injectable,
  Module,
  type NestInterceptor,
  Scope,
  type Type,
  UnauthorizedException,
} from "@nestjs/common";
import {
  APP_GUARD,
  APP_INTERCEPTOR,
  DiscoveryService,
  ModuleRef,
} from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { firstValueFrom, from, type Observable } from "rxjs";
import { z } from "zod";

import {
  canDiscoverMastraPrimitive,
  concealToolInstanceDependencies,
  isMastraToolInstance,
  wrapAgentDiscovery,
} from "./agent-discovery.js";
import {
  BaseAgent,
  BaseStep,
  BaseTool,
  BaseWorkflow,
  MastraManager,
  MastraModule,
} from "./index.js";

class Article {
  constructor(
    readonly id: string,
    readonly tenant: string,
  ) {}
}

class BillingLedger {}

class RefundOrder {}

interface MockModelToolDef {
  name: string;
}

/**
 * Creates an in-memory AI SDK V2 mock language model that records exposed tool names.
 * @param recordedToolNames - Destination list receiving exposed tool names per call
 * @returns LanguageModelV2 compatible mock
 */
function createRecordingMockModel(recordedToolNames: string[][]) {
  return {
    specificationVersion: "v2" as const,
    provider: "mock-provider",
    modelId: "mock-model",
    supportedUrls: {},
    doGenerate: (opts: { tools?: MockModelToolDef[] }) => {
      recordedToolNames.push((opts.tools ?? []).map((t) => t.name));
      return Promise.resolve({
        content: [{ type: "text" as const, text: "done" }],
        finishReason: "stop" as const,
        usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 },
        warnings: [],
      });
    },
    doStream: () => {
      throw new Error("Streaming not used in unit test");
    },
  };
}

/**
 * Resolves `RequestContextModule` from `@nest-boot/auth`'s imports without adding a direct test dependency.
 * @returns RequestContext NestJS module class
 */
function resolveRequestContextModule(): Type {
  const authImports = Reflect.getMetadata("imports", AuthModule) as
    | (Type | DynamicModule)[]
    | undefined;
  const mod = authImports?.find(
    (item): item is Type =>
      typeof item === "function" && item.name === "RequestContextModule",
  );
  if (!mod) {
    throw new Error("Expected RequestContextModule in AuthModule imports");
  }
  return mod;
}

/**
 * Creates a real `AuthContext` backed by an in-memory mock `EntityManager`.
 * @returns Configured `AuthContext` instance
 */
function createTestAuthContext(): AuthContext {
  const mockEntityManager = {
    getSessionContext: () => ({ role: "anonymous", variables: {} }),
    setSessionContext: () => undefined,
  } as unknown as ConstructorParameters<typeof AuthContext>[0];

  return new AuthContext(mockEntityManager, {
    user: {
      permissions: [
        "article:read",
        "article:update",
        "billing:manage",
        "refund:create",
      ],
    },
    buildAbility: ({ builder, permissions }) => {
      if (permissions.includes("article:read")) {
        builder.can("read", Article, { tenant: "acme" });
      }
      if (permissions.includes("article:update")) {
        builder.can("update", Article);
      }
      if (permissions.includes("billing:manage")) {
        builder.can("manage", BillingLedger);
      }
      if (permissions.includes("refund:create")) {
        builder.can("create", RefundOrder);
      }
    },
  });
}

/**
 * Runs an async callback inside a real `RequestContext` initialized with the supplied identity.
 * @param interceptor - Active `RequestContextInterceptor` instance
 * @param authContext - Active `AuthContext` instance
 * @param identity - Optional user ID and permission grants (`null` for anonymous HTTP caller)
 * @param fn - Callback executed inside the request context
 * @returns Resolved callback value
 */
async function runWithIdentity<T>(
  interceptor: NestInterceptor,
  authContext: AuthContext,
  identity: { userId: string; permissions: string[] } | null,
  fn: () => Promise<T>,
): Promise<T> {
  const mockExecCtx = {
    getType: () => "http",
    switchToHttp: () => ({
      getRequest: () => ({ get: () => undefined, headers: {} }),
      getResponse: () => ({}),
      getNext: () => undefined,
    }),
  } as unknown as ExecutionContext;

  const stream = await interceptor.intercept(mockExecCtx, {
    handle: () =>
      from(
        (async () => {
          if (identity) {
            const user = Object.assign(new User(), {
              id: identity.userId,
              permissions: identity.permissions,
            });
            const session = Object.assign(new Session(), {
              id: `sess-${identity.userId}`,
              userId: identity.userId,
            });
            authContext.initialize({ user, session });
          }
          return await fn();
        })(),
      ),
  } as CallHandler<T>);

  return await firstValueFrom(stream as Observable<T>);
}

const ORIGINAL_ENV = {
  DATABASE_URL: process.env.DATABASE_URL,
  MASTRA_DATABASE_URL: process.env.MASTRA_DATABASE_URL,
  MASTRA_CLICKHOUSE_URL: process.env.MASTRA_CLICKHOUSE_URL,
};

describe("Agent @Can discovery filtering and Tool provider discovery", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.MASTRA_DATABASE_URL;
    delete process.env.MASTRA_CLICKHOUSE_URL;
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(ORIGINAL_ENV)) {
      if (val === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = val;
      }
    }
  });

  it("filters @Can-protected tools, sub-agents, and workflows on Agent discovery while keeping unannotated primitives and direct NestJS calls unrestricted", async () => {
    const recordedSupervisorTools: string[][] = [];
    const recordedSubAgentTools: string[][] = [];
    const dynamicCallbackSpy = vi.fn();

    @Injectable()
    class TenantDirectoryService {
      readonly circularSelf: TenantDirectoryService = this;
      readonly internalToken = "do-not-serialize";

      resolveArticle(tenant: string): Article {
        return new Article("art-1", tenant);
      }
    }

    // 1. Unrestricted BaseTool (no @Can) with injected DI service
    @Injectable()
    class PublicEchoTool extends BaseTool({
      description: "Echoes text for any caller including background jobs",
      inputSchema: z.object({ text: z.string() }),
      outputSchema: z.object({ echoed: z.string() }),
    }) {
      constructor(readonly directory: TenantDirectoryService) {
        super();
      }

      execute(input: { text: string }) {
        return Promise.resolve({ echoed: input.text });
      }
    }

    // 2. Stacked class-level @Can BaseTool
    @Can("read", Article)
    @Can("update", Article)
    @Injectable()
    class PublishArticleTool extends BaseTool({
      description: "Requires both article:read and article:update",
      inputSchema: z.object({ title: z.string() }),
      outputSchema: z.object({ published: z.string() }),
    }) {
      execute(input: { title: string }) {
        return Promise.resolve({ published: input.title });
      }
    }

    // 3. Dynamic @Can callback BaseTool reading `self` + Mastra `{ requestContext }`
    @Can(
      "read",
      (
        self: TenantScopedArticleTool,
        options?: { requestContext?: MastraRequestContext },
      ) => {
        const tenant = String(
          options?.requestContext?.get("tenant") ?? "other",
        );
        dynamicCallbackSpy(tenant);
        return self.directory.resolveArticle(tenant);
      },
    )
    @Injectable()
    class TenantScopedArticleTool extends BaseTool({
      description: "Reads tenant-scoped articles",
      outputSchema: z.object({ ok: z.boolean() }),
    }) {
      constructor(readonly directory: TenantDirectoryService) {
        super();
      }

      execute() {
        return Promise.resolve({ ok: true });
      }
    }

    // 4. Sub-Agents: one unrestricted, one @Can-protected (which itself holds a @Can tool)
    @Injectable()
    class GeneralHelperAgent extends BaseAgent {
      constructor() {
        super({
          name: "General Helper",
          instructions: "Unrestricted sub-agent.",
          model: createRecordingMockModel(recordedSubAgentTools),
        });
      }
    }

    @Can("manage", BillingLedger)
    @Injectable()
    class BillingSpecialistAgent extends BaseAgent {
      constructor(
        publicEcho: PublicEchoTool,
        publishArticle: PublishArticleTool,
      ) {
        super({
          name: "Billing Specialist",
          instructions: "Handles billing tasks.",
          model: createRecordingMockModel(recordedSubAgentTools),
          tools: {
            publicEcho,
            publishArticle,
          },
        });
      }
    }

    // 5. Workflows: one unrestricted, one @Can-protected
    @Injectable()
    class FormatStep extends BaseStep({
      inputSchema: z.object({ amount: z.number() }),
      outputSchema: z.object({ refunded: z.number() }),
    }) {
      execute({ inputData }: { inputData: { amount: number } }) {
        return Promise.resolve({ refunded: inputData.amount });
      }
    }

    @Injectable()
    class SummaryWorkflow extends BaseWorkflow({
      inputSchema: z.object({ amount: z.number() }),
      outputSchema: z.object({ refunded: z.number() }),
    }) {
      constructor(step: FormatStep) {
        super();
        this.then(step).commit();
      }
    }

    @Can("create", RefundOrder)
    @Injectable()
    class RefundWorkflow extends BaseWorkflow({
      inputSchema: z.object({ amount: z.number() }),
      outputSchema: z.object({ refunded: z.number() }),
    }) {
      constructor(step: FormatStep) {
        super();
        this.then(step).commit();
      }
    }

    const plainFunctionalTool = createTool({
      id: "plain-calc",
      description: "Plain functional tool",
      execute: () => Promise.resolve({ sum: 2 }),
    });

    // 6. Supervisor Agent combining tools, sub-agents, and workflows
    @Injectable()
    class SupervisorAgent extends BaseAgent {
      constructor(
        publicEcho: PublicEchoTool,
        publishArticle: PublishArticleTool,
        tenantArticle: TenantScopedArticleTool,
        generalHelper: GeneralHelperAgent,
        billingSpecialist: BillingSpecialistAgent,
        summaryWorkflow: SummaryWorkflow,
        refundWorkflow: RefundWorkflow,
      ) {
        super({
          name: "Supervisor Agent",
          instructions: "Coordinate tools, sub-agents, and workflows.",
          model: createRecordingMockModel(recordedSupervisorTools),
          tools: {
            publicEcho,
            publishArticle,
            tenantArticle,
            plainCalc: plainFunctionalTool,
          },
          agents: {
            generalHelper,
            billingSpecialist,
          },
          workflows: {
            summaryWorkflow,
            refundWorkflow,
          },
        });
      }
    }

    const RequestContextMod = resolveRequestContextModule();
    const requestContextInterceptorToken = (
      Reflect.getMetadata("providers", RequestContextMod) as {
        provide?: unknown;
        useClass?: Type<NestInterceptor>;
      }[]
    ).find((p) => p.provide === APP_INTERCEPTOR)?.useClass;
    if (!requestContextInterceptorToken) {
      throw new Error("Expected RequestContextInterceptor");
    }

    const authContext = createTestAuthContext();

    @Global()
    @Module({
      providers: [{ provide: AuthContext, useValue: authContext }],
      exports: [AuthContext],
    })
    class TestAuthModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [RequestContextMod, TestAuthModule, MastraModule.forRoot()],
      providers: [
        // Simulate a third-party HTTP-only APP_GUARD that would crash if invoked outside HTTP
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (ctx: ExecutionContext) =>
              Boolean(
                ctx.switchToHttp().getRequest<{ headers: object }>().headers,
              ),
          },
        },
        TenantDirectoryService,
        PublicEchoTool,
        PublishArticleTool,
        TenantScopedArticleTool,
        GeneralHelperAgent,
        BillingSpecialistAgent,
        FormatStep,
        SummaryWorkflow,
        RefundWorkflow,
        SupervisorAgent,
      ],
    }).compile();

    await moduleRef.init();

    try {
      const manager = moduleRef.get(MastraManager);
      const requestContextInterceptor = new requestContextInterceptorToken(
        moduleRef.get(ModuleRef),
      );
      const supervisor = moduleRef.get(SupervisorAgent);
      const billingAgent = moduleRef.get(BillingSpecialistAgent);
      const publicEchoTool = moduleRef.get(PublicEchoTool);
      const publishArticleTool = moduleRef.get(PublishArticleTool);
      const refundWorkflow = moduleRef.get(RefundWorkflow);

      // MastraManager discovers singleton Tool, Agent, and Workflow providers
      expect(manager.getTools()).toEqual(
        expect.arrayContaining([publicEchoTool, publishArticleTool]),
      );
      expect(manager.getTool("public-echo-tool")).toBe(publicEchoTool);
      expect(manager.getTool("non-existent-tool")).toBeUndefined();
      expect(manager.getAgent("supervisor-agent")).toBe(supervisor);
      expect(manager.getWorkflow("refund-workflow")).toBe(refundWorkflow);

      // Injected NestJS service on BaseTool is non-enumerable so `{ ...tool }` / JSON.stringify never leaks DI graphs
      expect(Object.keys({ ...publicEchoTool })).not.toContain("directory");
      expect(() => JSON.stringify({ ...publicEchoTool })).not.toThrow();

      // A. Outside RequestContext (e.g. @Cron / @Processor / internal NestJS call):
      //    - Unannotated tools, sub-agents, and workflows work seamlessly
      //    - @Can-protected items are hidden from Agent discovery without invoking dynamic callbacks
      //    - Direct programmatic calls to restricted tools/workflows are NOT blocked
      expect(Object.keys(await supervisor.listTools())).toEqual([
        "publicEcho",
        "plainCalc",
      ]);
      // Synchronous listAgents() contract is preserved for static sub-agent maps
      const syncAgents = supervisor.listAgents();
      expect(syncAgents).not.toBeInstanceOf(Promise);
      expect(Object.keys(syncAgents)).toEqual(["generalHelper"]);
      expect(Object.keys(await supervisor.listAgents())).toEqual([
        "generalHelper",
      ]);
      expect(Object.keys(await supervisor.listWorkflows())).toEqual([
        "summaryWorkflow",
      ]);
      expect(dynamicCallbackSpy).not.toHaveBeenCalled();

      // Direct NestJS internal call to @Can-protected tool & workflow succeeds without RequestContext
      expect(await publishArticleTool.execute({ title: "Internal" })).toEqual({
        published: "Internal",
      });
      const run = await refundWorkflow.createRun();
      const wfResult = await run.start({ inputData: { amount: 50 } });
      expect(wfResult.status).toBe("success");

      // B. Anonymous HTTP RequestContext: same visibility, dynamic callback never called
      await runWithIdentity(
        requestContextInterceptor,
        authContext,
        null,
        async () => {
          recordedSupervisorTools.length = 0;
          await supervisor.generate("What can you do?", {
            toolsets: {
              extraToolset: {
                extraProtected: publishArticleTool,
                extraPublic: publicEchoTool,
              },
            },
            clientTools: {
              clientProtected: publishArticleTool,
              clientPublic: publicEchoTool,
            },
          });
          expect(recordedSupervisorTools[0]).toEqual(
            expect.arrayContaining([
              "publicEcho",
              "plainCalc",
              "extraPublic",
              "clientPublic",
              "agent-generalHelper",
              "workflow-summaryWorkflow",
            ]),
          );
          expect(recordedSupervisorTools[0]).not.toContain("publishArticle");
          expect(recordedSupervisorTools[0]).not.toContain("extraProtected");
          expect(recordedSupervisorTools[0]).not.toContain("clientProtected");
          expect(recordedSupervisorTools[0]).not.toContain("tenantArticle");
          expect(recordedSupervisorTools[0]).not.toContain(
            "agent-billingSpecialist",
          );
          expect(recordedSupervisorTools[0]).not.toContain(
            "workflow-refundWorkflow",
          );
          expect(dynamicCallbackSpy).not.toHaveBeenCalled();
        },
      );

      // C. Authenticated reader in tenant "acme" (has article:read only, lazy AuthContext.getAbility() path)
      await runWithIdentity(
        requestContextInterceptor,
        authContext,
        { userId: "reader-1", permissions: ["article:read"] },
        async () => {
          const acmeCtx = new MastraRequestContext();
          acmeCtx.set("tenant", "acme");

          // Stacked @Can("read") + @Can("update") on publishArticle denies when article:update is missing
          expect(
            Object.keys(
              await supervisor.listTools({ requestContext: acmeCtx }),
            ),
          ).toEqual(["publicEcho", "tenantArticle", "plainCalc"]);
          expect(dynamicCallbackSpy).toHaveBeenCalledWith("acme");

          const wrongTenantCtx = new MastraRequestContext();
          wrongTenantCtx.set("tenant", "other-tenant");
          const filteredTools = await supervisor.listTools({
            requestContext: wrongTenantCtx,
          });
          expect(Object.keys(filteredTools)).toEqual([
            "publicEcho",
            "plainCalc",
          ]);
          // Null-prototype dictionary prevents Object.prototype key leakage in network dispatch
          expect(Object.getPrototypeOf(filteredTools)).toBeNull();
          expect("toString" in filteredTools).toBe(false);
          expect(Reflect.get(filteredTools, "toString")).toBeUndefined();
        },
      );

      // D. Privileged user with billing:manage + refund:create + article:read + article:update
      await runWithIdentity(
        requestContextInterceptor,
        authContext,
        {
          userId: "admin-1",
          permissions: [
            "article:read",
            "article:update",
            "billing:manage",
            "refund:create",
          ],
        },
        async () => {
          const acmeCtx = new MastraRequestContext();
          acmeCtx.set("tenant", "acme");

          recordedSupervisorTools.length = 0;
          await supervisor.generate("Run full suite", {
            requestContext: acmeCtx,
            toolsets: {
              extraToolset: {
                extraProtected: publishArticleTool,
              },
            },
            clientTools: {
              clientProtected: publishArticleTool,
            },
          });
          expect(recordedSupervisorTools[0]).toEqual(
            expect.arrayContaining([
              "publicEcho",
              "publishArticle",
              "tenantArticle",
              "plainCalc",
              "extraProtected",
              "clientProtected",
              "agent-generalHelper",
              "agent-billingSpecialist",
              "workflow-summaryWorkflow",
              "workflow-refundWorkflow",
            ]),
          );

          // Forked clone preserves discovery filtering
          const forked = (
            supervisor as unknown as { __fork: () => MastraAgent }
          ).__fork();
          expect(
            Object.keys(await forked.listAgents({ requestContext: acmeCtx })),
          ).toEqual(["generalHelper", "billingSpecialist"]);
        },
      );

      // E. Sub-agent recursively filters its own tools based on the caller's permissions
      await runWithIdentity(
        requestContextInterceptor,
        authContext,
        { userId: "billing-only", permissions: ["billing:manage"] },
        async () => {
          const exposedAgents = await supervisor.listAgents();
          expect(Object.keys(exposedAgents)).toEqual([
            "generalHelper",
            "billingSpecialist",
          ]);

          recordedSubAgentTools.length = 0;
          await billingAgent.generate("Process invoice");
          expect(recordedSubAgentTools[0]).toEqual(["publicEcho"]);
          expect(recordedSubAgentTools[0]).not.toContain("publishArticle");
        },
      );
    } finally {
      await moduleRef.close();
    }
  });

  it("covers ad-hoc sub-agent wrapping, dynamic callback error handling, runtime registration hooks, and provider validation/rollback", async () => {
    const authContext = createTestAuthContext();
    const RequestContextMod = resolveRequestContextModule();
    const requestContextInterceptorToken = (
      Reflect.getMetadata("providers", RequestContextMod) as {
        provide?: unknown;
        useClass?: Type<NestInterceptor>;
      }[]
    ).find((p) => p.provide === APP_INTERCEPTOR)?.useClass;
    if (!requestContextInterceptorToken) {
      throw new Error("Expected RequestContextInterceptor");
    }

    // 1. Primitive / non-object & dynamic callback error branches
    expect(await canDiscoverMastraPrimitive(null)).toBe(true);
    expect(isMastraToolInstance(null)).toBe(false);
    concealToolInstanceDependencies(null);
    concealToolInstanceDependencies(
      createTool({
        id: "plain",
        description: "Plain",
        execute: () => Promise.resolve({}),
      }),
    );

    @Can("read", () => {
      throw new HttpException("Custom 403", HttpStatus.FORBIDDEN);
    })
    class Http403DeniedTool extends BaseTool({
      description: "Throws HttpException 403 in subject callback",
    }) {
      execute() {
        return Promise.resolve({});
      }
    }

    @Can("read", () => {
      throw new UnauthorizedException("Expired token");
    })
    class UnauthorizedCallbackTool extends BaseTool({
      description: "Throws UnauthorizedException in subject callback",
    }) {
      execute() {
        return Promise.resolve({});
      }
    }

    @Can("read", () => {
      throw new TypeError("Unexpected callback bug");
    })
    class BuggyCallbackTool extends BaseTool({
      description: "Throws unexpected TypeError in subject callback",
    }) {
      execute() {
        return Promise.resolve({});
      }
    }

    // Ad-hoc raw MastraAgent sub-agent discovered dynamically via listAgents() gets wrapped recursively
    const adHocChildAgent = new MastraAgent({
      id: "ad-hoc-child",
      name: "AdHoc Child",
      instructions: "Child",
      model: "openai/gpt-4o-mini",
      tools: {
        denied403: new Http403DeniedTool(),
        denied401: new UnauthorizedCallbackTool(),
      },
    });

    const adHocParentAgent = new MastraAgent({
      id: "ad-hoc-parent",
      name: "AdHoc Parent",
      instructions: "Parent",
      model: "openai/gpt-4o-mini",
      agents: () => ({ child: adHocChildAgent }),
    });
    wrapAgentDiscovery(adHocParentAgent);
    // Idempotent second wrap
    wrapAgentDiscovery(adHocParentAgent);

    // Forked protected sub-agent retains source @Can metadata & receiver;
    // standalone BaseAgent with prototype method override stays wrapped;
    // class-field override attempting to replace locked discovery wrapper is rejected;
    // null-prototype structural tools work without constructor TypeError;
    // static/async @Can with undefined subject fails closed;
    // method-level @Can on Tool.execute fails fast with clear guidance.
    @Can("manage", BillingLedger)
    class ProtectedForkableSubAgent extends BaseAgent {
      constructor() {
        super({
          name: "Protected Forkable SubAgent",
          instructions: "Protected",
          model: "openai/gpt-4o-mini",
        });
      }
    }
    const protectedSubAgent = new ProtectedForkableSubAgent();
    const forkedProtectedSubAgent = (
      protectedSubAgent as unknown as { __fork: () => MastraAgent }
    ).__fork();

    class StandaloneMethodOverrideAgent extends BaseAgent {
      constructor() {
        super({
          name: "Standalone Method Override",
          instructions: "Overrides listAgents via prototype method",
          model: "openai/gpt-4o-mini",
        });
      }

      override listAgents() {
        return Promise.resolve({
          forkedBilling: forkedProtectedSubAgent,
        });
      }
    }
    const standaloneOverrideAgent = new StandaloneMethodOverrideAgent();
    expect(Object.keys(await standaloneOverrideAgent.listAgents())).toEqual([]);

    class FieldOverrideAgent extends BaseAgent {
      constructor() {
        super({
          name: "Field Override Agent",
          instructions:
            "Attempts to overwrite locked listAgents via class field",
          model: "openai/gpt-4o-mini",
        });
      }

      override listAgents = () =>
        Promise.resolve({
          forkedBilling: forkedProtectedSubAgent,
        });
    }
    expect(() => new FieldOverrideAgent()).toThrow(TypeError);

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

    class UndefinedStaticSubjectTool extends BaseTool({
      description:
        "Simulates circular import leaving static @Can subject undefined",
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

    @Can("read", () => Promise.resolve(new Article("art-async", "acme")))
    class AsyncAuthorizedCallbackTool extends BaseTool({
      description: "Async subject callback returning Article in acme tenant",
    }) {
      execute() {
        return Promise.resolve({});
      }
    }

    @Can("read", () => Promise.reject(new UnauthorizedException("Async 401")))
    class AsyncUnauthorizedCallbackTool extends BaseTool({
      description: "Async subject callback rejecting with 401",
    }) {
      execute() {
        return Promise.resolve({});
      }
    }

    @Can("read", () => Promise.reject(new RangeError("Async unexpected bug")))
    class AsyncBuggyCallbackTool extends BaseTool({
      description: "Async subject callback rejecting with unexpected error",
    }) {
      execute() {
        return Promise.resolve({});
      }
    }

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

    @Global()
    @Module({
      providers: [{ provide: AuthContext, useValue: authContext }],
      exports: [AuthContext],
    })
    class TestAuthModule {}

    const helperRef = await Test.createTestingModule({
      imports: [RequestContextMod, TestAuthModule, MastraModule.forRoot()],
    }).compile();
    await helperRef.init();

    try {
      const interceptor = new requestContextInterceptorToken(
        helperRef.get(ModuleRef),
      );
      const mastra = helperRef.get(Mastra);
      const manager = helperRef.get(MastraManager);

      // Runtime mastra.addTool and mastra.addAgent hooks
      const runtimeTool = new Http403DeniedTool();
      Object.assign(runtimeTool, { leakedDep: "secret" });
      mastra.addTool(runtimeTool, "runtime-tool");
      expect(Object.keys({ ...runtimeTool })).not.toContain("leakedDep");

      const runtimeAgent = new MastraAgent({
        id: "runtime-added-agent",
        name: "Runtime Agent",
        instructions: "Added at runtime",
        model: "openai/gpt-4o-mini",
        tools: { denied403: runtimeTool },
      });
      mastra.addAgent(runtimeAgent);
      expect(manager.getAgents()).toContain(runtimeAgent);
      expect(manager.getWorkflows()).toEqual([]);

      await runWithIdentity(
        interceptor,
        authContext,
        { userId: "u-1", permissions: ["article:read"] },
        async () => {
          const children = await adHocParentAgent.listAgents();
          expect(Object.keys(children)).toEqual(["child"]);
          // Child's own tools were recursively wrapped and both 401/403 callbacks resolved to false
          expect(
            Object.keys(await (children.child as MastraAgent).listTools()),
          ).toEqual([]);
          expect(Object.keys(await runtimeAgent.listTools())).toEqual([]);

          // Undefined static @Can subject fails closed even for authenticated users
          expect(
            await canDiscoverMastraPrimitive(new UndefinedStaticSubjectTool()),
          ).toBe(false);

          // Async subjectCallback resolution & async 401 denial in filterAuthorizedRecord
          const asyncToolAgent = new MastraAgent({
            id: "async-tool-agent",
            name: "Async Tool Agent",
            instructions: "Tests async subjectCallback",
            model: "openai/gpt-4o-mini",
            agents: {
              allowedAsync: Object.assign(
                new MastraAgent({
                  id: "allowed-async-sub",
                  name: "Allowed Async Sub",
                  instructions: "Sub",
                  model: "openai/gpt-4o-mini",
                }),
              ),
            },
            tools: {
              nullProto: nullProtoStructuralTool as never,
              undefinedSubject: new UndefinedStaticSubjectTool(),
              asyncAllowed: new AsyncAuthorizedCallbackTool(),
              asyncDenied401: new AsyncUnauthorizedCallbackTool(),
            },
          });
          wrapAgentDiscovery(asyncToolAgent);
          expect(Object.keys(await asyncToolAgent.listTools())).toEqual([
            "nullProto",
            "asyncAllowed",
          ]);

          // getDefaultOptions() stays synchronous when no toolsets/clientTools are present,
          // and filters static & dynamic defaultOptions.toolsets and clientTools
          const plainDefaultOptsAgent = new MastraAgent({
            id: "plain-default-opts-agent",
            name: "Plain Default Opts Agent",
            instructions: "Tests sync defaultOptions passthrough",
            model: "openai/gpt-4o-mini",
            defaultOptions: { maxSteps: 3 },
          });
          wrapAgentDiscovery(plainDefaultOptsAgent);
          expect(plainDefaultOptsAgent.getDefaultOptions()).toEqual({
            maxSteps: 3,
          });

          const staticDefaultOptsAgent = new MastraAgent({
            id: "static-default-opts-agent",
            name: "Static Default Opts Agent",
            instructions: "Tests static defaultOptions filtering",
            model: "openai/gpt-4o-mini",
            defaultOptions: {
              maxSteps: 3,
              toolsets: {
                emptySet: {},
                mixedSet: {
                  denied: new UndefinedStaticSubjectTool(),
                  allowed: nullProtoStructuralTool as never,
                },
              },
              clientTools: {
                deniedClient: new UndefinedStaticSubjectTool(),
                allowedClient: nullProtoStructuralTool as never,
              },
            },
          });
          wrapAgentDiscovery(staticDefaultOptsAgent);
          const filteredStaticOpts =
            await staticDefaultOptsAgent.getDefaultOptions();
          expect(
            Object.keys(
              (
                filteredStaticOpts as {
                  toolsets: { mixedSet: Record<string, unknown> };
                }
              ).toolsets.mixedSet,
            ),
          ).toEqual(["allowed"]);
          expect(
            Object.keys(
              (filteredStaticOpts as { clientTools: Record<string, unknown> })
                .clientTools,
            ),
          ).toEqual(["allowedClient"]);

          const asyncDefaultOptsAgent = new MastraAgent({
            id: "async-default-opts-agent",
            name: "Async Default Opts Agent",
            instructions: "Tests async defaultOptions filtering",
            model: "openai/gpt-4o-mini",
            defaultOptions: () =>
              Promise.resolve({
                toolsets: {
                  asyncSet: {
                    asyncAllowed: new AsyncAuthorizedCallbackTool(),
                    asyncDenied: new AsyncUnauthorizedCallbackTool(),
                  },
                },
                clientTools: {
                  asyncAllowedClient: new AsyncAuthorizedCallbackTool(),
                  asyncDeniedClient: new AsyncUnauthorizedCallbackTool(),
                },
              }),
          });
          wrapAgentDiscovery(asyncDefaultOptsAgent);
          const resolvedAsyncDefaults =
            await asyncDefaultOptsAgent.getDefaultOptions();
          expect(
            Object.keys(
              (
                resolvedAsyncDefaults as {
                  toolsets: { asyncSet: Record<string, unknown> };
                }
              ).toolsets.asyncSet,
            ),
          ).toEqual(["asyncAllowed"]);
          expect(
            Object.keys(
              (
                resolvedAsyncDefaults as {
                  clientTools: Record<string, unknown>;
                }
              ).clientTools,
            ),
          ).toEqual(["asyncAllowedClient"]);

          // Sync throw after an async rejecting callback does not leak an unhandledRejection
          const unhandled: unknown[] = [];
          const onUnhandled = (reason: unknown) => {
            unhandled.push(reason);
          };
          process.on("unhandledRejection", onUnhandled);
          try {
            const mixedFailureAgent = new MastraAgent({
              id: "mixed-failure-agent",
              name: "Mixed Failure Agent",
              instructions: "Tests sync throw after async rejection",
              model: "openai/gpt-4o-mini",
              tools: {
                firstAsyncBug: new AsyncBuggyCallbackTool(),
                secondSyncBug: new BuggyCallbackTool(),
              },
            });
            wrapAgentDiscovery(mixedFailureAgent);
            await expect(mixedFailureAgent.listTools()).rejects.toThrow(
              "Unexpected callback bug",
            );
            await new Promise((resolve) => setImmediate(resolve));
            expect(unhandled).toEqual([]);
          } finally {
            process.off("unhandledRejection", onUnhandled);
          }

          // Unexpected TypeError inside subjectCallback propagates rather than silently hiding bugs
          await expect(
            canDiscoverMastraPrimitive(new BuggyCallbackTool()),
          ).rejects.toThrow("Unexpected callback bug");
        },
      );
    } finally {
      await helperRef.close();
    }

    // 2. Provider validation & rollback on failed onModuleInit:
    //    a) Request-scoped tool provider is rejected and rolls back pre-registered tools
    @Injectable()
    class ValidSingletonTool extends BaseTool({
      id: "valid-singleton-tool",
      description: "Valid tool registered before failure",
    }) {
      execute() {
        return Promise.resolve({});
      }
    }

    @Injectable({ scope: Scope.REQUEST })
    class InvalidRequestScopedTool extends BaseTool({
      description: "Invalid request-scoped tool",
    }) {
      execute() {
        return Promise.resolve({});
      }
    }

    const scopedRef = await Test.createTestingModule({
      imports: [MastraModule.forRoot()],
      providers: [ValidSingletonTool, InvalidRequestScopedTool],
    }).compile();

    try {
      const mastra = scopedRef.get(Mastra);
      await expect(scopedRef.init()).rejects.toThrow(
        /must be a singleton Mastra Tool provider/,
      );
      expect(Object.keys(mastra.listTools() ?? {})).toEqual([]);
    } finally {
      await scopedRef.close().catch(() => undefined);
    }

    //    b) Duplicate tool provider IDs
    @Injectable()
    class DupTool1 extends BaseTool({
      id: "dup-id",
      description: "Dup 1",
    }) {
      execute() {
        return Promise.resolve({});
      }
    }

    @Injectable()
    class DupTool2 extends BaseTool({
      id: "dup-id",
      description: "Dup 2",
    }) {
      execute() {
        return Promise.resolve({});
      }
    }

    const dupRef = await Test.createTestingModule({
      imports: [MastraModule.forRoot()],
      providers: [DupTool1, DupTool2],
    }).compile();
    try {
      await expect(dupRef.init()).rejects.toThrow(
        /Mastra tool "dup-id" has multiple providers/,
      );
    } finally {
      await dupRef.close().catch(() => undefined);
    }

    //    c) Preconfigured tool ID collision & registration-key collision
    const preconfIdRef = await Test.createTestingModule({
      imports: [
        MastraModule.forRoot({
          tools: {
            otherKey: createTool({
              id: "dup-id",
              description: "Same id under different key",
              execute: () => Promise.resolve({}),
            }),
          },
        }),
      ],
      providers: [DupTool1],
    }).compile();
    try {
      await expect(preconfIdRef.init()).rejects.toThrow(
        /Mastra tool "dup-id" has multiple providers/,
      );
    } finally {
      await preconfIdRef.close().catch(() => undefined);
    }

    const preconfKeyRef = await Test.createTestingModule({
      imports: [
        MastraModule.forRoot({
          tools: {
            "dup-id": createTool({
              id: "different-intrinsic-id",
              description: "Different id under colliding key",
              execute: () => Promise.resolve({}),
            }),
          },
        }),
      ],
      providers: [DupTool1],
    }).compile();
    try {
      await expect(preconfKeyRef.init()).rejects.toThrow(
        /collides with an existing tool registered under key "dup-id"/,
      );
    } finally {
      await preconfKeyRef.close().catch(() => undefined);
    }

    //    d) Same tool instance shared in both preconfigured tools and providers is deduplicated cleanly
    const sharedToolInstance = new ValidSingletonTool();
    const sharedDiscovery = {
      getProviders: () => [
        {
          isAlias: false,
          instance: sharedToolInstance,
          metatype: ValidSingletonTool,
          isDependencyTreeStatic: () => true,
          isTransient: false,
        },
        {
          isAlias: false,
          instance: sharedToolInstance,
          metatype: ValidSingletonTool,
          isDependencyTreeStatic: () => true,
          isTransient: false,
        },
      ],
    } as unknown as DiscoveryService;
    const standaloneMastra = new Mastra({
      tools: { "valid-singleton-tool": sharedToolInstance },
    });
    const standaloneManager = new MastraManager(
      sharedDiscovery,
      standaloneMastra,
    );
    standaloneManager.onModuleInit();
    expect(standaloneManager.getTools()).toEqual([sharedToolInstance]);
  });
});
