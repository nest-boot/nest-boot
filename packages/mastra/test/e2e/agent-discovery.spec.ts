import { Agent as MastraAgent } from "@mastra/core/agent";
import { RequestContext as MastraRequestContext } from "@mastra/core/request-context";
import { createTool } from "@mastra/core/tools";
import { AuthContext, AuthModule, Can, Session, User } from "@nest-boot/auth";
import {
  type CallHandler,
  type DynamicModule,
  type ExecutionContext,
  Global,
  Injectable,
  Module,
  type NestInterceptor,
  type Type,
} from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR, ModuleRef } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { firstValueFrom, from, type Observable } from "rxjs";
import { z } from "zod";

import {
  BaseAgent,
  BaseStep,
  BaseTool,
  BaseWorkflow,
  MastraManager,
  MastraModule,
} from "../../src/index.js";

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
      throw new Error("Streaming not used in E2E test");
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

describe("Agent @Can discovery filtering (e2e)", () => {
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

  it("filters @Can-protected tools, toolsets, clientTools, sub-agents, and workflows while keeping unannotated primitives and direct NestJS calls unrestricted", async () => {
    const recordedSupervisorTools: string[][] = [];
    const recordedSubAgentTools: string[][] = [];
    const dynamicCallbackSpy = vi.fn();

    @Injectable()
    class TenantDirectoryService {
      readonly circularSelf: TenantDirectoryService = this;

      resolveArticle(tenant: string): Article {
        return new Article("art-1", tenant);
      }
    }

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

      expect(manager.getTools()).toEqual(
        expect.arrayContaining([publicEchoTool, publishArticleTool]),
      );
      expect(() => JSON.stringify({ ...publicEchoTool })).not.toThrow();

      // Outside RequestContext: unannotated visible, @Can hidden, direct programmatic calls succeed
      const syncAgents = supervisor.listAgents();
      expect(syncAgents).not.toBeInstanceOf(Promise);
      expect(Object.keys(syncAgents)).toEqual(["generalHelper"]);
      expect(Object.keys(await supervisor.listTools())).toEqual([
        "publicEcho",
        "plainCalc",
      ]);
      expect(Object.keys(await supervisor.listWorkflows())).toEqual([
        "summaryWorkflow",
      ]);
      expect(dynamicCallbackSpy).not.toHaveBeenCalled();

      expect(await publishArticleTool.execute({ title: "Internal" })).toEqual({
        published: "Internal",
      });
      const run = await refundWorkflow.createRun();
      const wfResult = await run.start({ inputData: { amount: 50 } });
      expect(wfResult.status).toBe("success");

      // Anonymous HTTP RequestContext
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

      // Reader in tenant "acme"
      await runWithIdentity(
        requestContextInterceptor,
        authContext,
        { userId: "reader-1", permissions: ["article:read"] },
        async () => {
          const acmeCtx = new MastraRequestContext();
          acmeCtx.set("tenant", "acme");
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
          expect(Object.getPrototypeOf(filteredTools)).toBeNull();
          expect("toString" in filteredTools).toBe(false);
        },
      );

      // Admin with all permissions
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
              extraToolset: { extraProtected: publishArticleTool },
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

          const forked = (
            supervisor as unknown as { __fork: () => MastraAgent }
          ).__fork();
          expect(
            Object.keys(await forked.listAgents({ requestContext: acmeCtx })),
          ).toEqual(["generalHelper", "billingSpecialist"]);
        },
      );

      // Recursive sub-agent filtering
      await runWithIdentity(
        requestContextInterceptor,
        authContext,
        { userId: "billing-only", permissions: ["billing:manage"] },
        async () => {
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
});
