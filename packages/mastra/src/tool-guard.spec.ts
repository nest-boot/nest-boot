import { Agent as MastraAgent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { RequestContext as MastraRequestContext } from "@mastra/core/request-context";
import {
  createTool,
  isValidationError,
  Tool as MastraTool,
} from "@mastra/core/tools";
import {
  AuthContext,
  AuthGuard,
  AuthModule,
  Can,
  Public,
  Session,
  User,
} from "@nest-boot/auth";
import {
  type CallHandler,
  type CanActivate,
  Catch,
  type DynamicModule,
  type ExceptionFilter,
  type ExecutionContext,
  ForbiddenException,
  Global,
  HttpException,
  HttpStatus,
  Injectable,
  Module,
  type NestInterceptor,
  Scope,
  type Type,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  APP_FILTER,
  APP_GUARD,
  APP_INTERCEPTOR,
  ModuleRef,
  Reflector,
} from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { firstValueFrom, from, type Observable } from "rxjs";
import { expectTypeOf } from "vitest";
import { z } from "zod";

import {
  BaseAgent,
  BaseTool,
  filterAccessibleTools,
  MASTRA_TOOL_DISCOVERY_CONTEXT_TYPE,
  MASTRA_TOOL_EXECUTION_CONTEXT_TYPE,
  MastraManager,
  MastraModule,
  type ToolContext,
  type ToolInput,
} from "./index.js";
import {
  assertCanExposeMastraTool,
  assertMastraPrimitivesAvailable,
  bindToolGuards,
  CAN_EXPOSE_TOOL,
  canExposeMastraTool,
  concealToolInstanceDependencies,
  isClassBasedMastraTool,
  wrapAgentToolDiscovery,
} from "./tool-guard.js";

class Article {
  constructor(
    readonly id: string,
    readonly authorId: string,
    readonly title: string,
  ) {}
}

class AdminSettings {}

@Injectable()
class ArticleRepository {
  private readonly items = new Map<string, Article>([
    ["art-own", new Article("art-own", "user-1", "My Draft")],
    ["art-other", new Article("art-other", "user-2", "Someone Else's Post")],
  ]);

  findById(id: string): Article {
    const found = this.items.get(id);
    if (!found) {
      throw new Error(`Article ${id} not found`);
    }
    return found;
  }
}

@Injectable()
class ServerFeatureFlagService {
  enabledForBeta = false;
  readonly seenContextTypes: string[] = [];
}

@Injectable({ scope: Scope.TRANSIENT })
class TransientBetaFeatureGuard implements CanActivate {
  constructor(private readonly flags: ServerFeatureFlagService) {}

  readonly canActivate = (context: ExecutionContext): boolean => {
    this.flags.seenContextTypes.push(context.getType<string>());
    if (!this.flags.enabledForBeta) {
      throw new HttpException("Beta feature disabled", HttpStatus.FORBIDDEN);
    }
    return true;
  };
}

/**
 * Extracts `RequestContextModule` from `AuthModule` metadata so unit tests run
 * inside a genuine `@nest-boot/request-context` scope without extra devDependencies.
 * @returns RequestContext NestJS module class
 */
function resolveRequestContextModule(): Type<unknown> | DynamicModule {
  const imports = Reflect.getMetadata("imports", AuthModule) as (
    | Type<unknown>
    | DynamicModule
  )[];
  const requestContextModule = imports[0];
  if (!requestContextModule) {
    throw new Error("Expected AuthModule to import RequestContextModule");
  }
  return requestContextModule;
}

/**
 * Creates a real `AuthContext`, `AuthGuard`, and `APP_GUARD` provider set backed by
 * an in-memory mock `EntityManager` and custom `buildAbility` rules.
 * @returns Providers for `AuthContext`, `AuthGuard`, and `APP_GUARD`
 */
function createAuthGuardProviders() {
  const mockEntityManager = {
    getSessionContext: () => ({ role: "anonymous", variables: {} }),
    setSessionContext: () => undefined,
  } as unknown as ConstructorParameters<typeof AuthContext>[0];

  const authContext = new AuthContext(mockEntityManager, {
    user: {
      permissions: ["article:read", "article:update:own", "admin:manage"],
    },
    buildAbility: ({ builder, permissions, user }) => {
      if (permissions.includes("article:read")) {
        builder.can("read", Article);
      }
      if (permissions.includes("article:update:own") && user) {
        builder.can("update", Article, { authorId: user.id });
      }
      if (permissions.includes("admin:manage")) {
        builder.can("manage", AdminSettings);
      }
    },
  });

  return [
    {
      provide: AuthContext,
      useValue: authContext,
    },
    {
      provide: AuthGuard,
      inject: [Reflector, ModuleRef, AuthContext],
      useFactory: (
        reflector: Reflector,
        moduleRef: ModuleRef,
        ctx: AuthContext,
      ) => new AuthGuard(reflector, moduleRef, ctx),
    },
    {
      provide: APP_GUARD,
      useExisting: AuthGuard,
    },
  ];
}

/**
 * Runs an async callback inside a real `RequestContext` initialized with the supplied identity.
 * @param interceptor - Active `RequestContextInterceptor` instance
 * @param authContext - Active `AuthContext` instance
 * @param identity - Optional user ID and permission grants (`null` for anonymous)
 * @param fn - Callback executed inside the request context
 * @returns Resolved callback value
 */
async function runWithAuthIdentity<T>(
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

describe("BaseTool Guard authorization and exposure filtering", () => {
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

  it("enforces APP_GUARD, @Public, static @Can, dynamic @Can, and transient DI @UseGuards at both exposure and execution time without leaking schemas or triggering global interceptors/filters", async () => {
    const interceptorSpy = vi.fn();
    const filterSpy = vi.fn();
    const adminExecuteSpy = vi.fn();
    const updateExecuteSpy = vi.fn();
    const dynamicSubjectSpy = vi.fn();

    @Injectable()
    class GlobalSpyInterceptor implements NestInterceptor {
      intercept(
        _context: ExecutionContext,
        next: CallHandler,
      ): Observable<unknown> {
        interceptorSpy();
        return next.handle();
      }
    }

    @Catch()
    @Injectable()
    class GlobalSpyFilter implements ExceptionFilter {
      catch(exception: unknown): never {
        filterSpy(exception);
        throw exception;
      }
    }

    @Public()
    @Injectable()
    class PublicHealthTool extends BaseTool({
      description: "Public health check tool",
      outputSchema: z.object({ status: z.string() }),
    }) {
      execute() {
        return Promise.resolve({ status: "ok" });
      }
    }

    @Injectable()
    class WhoAmITool extends BaseTool({
      description: "Returns current user id for any authenticated caller",
      outputSchema: z.object({ userId: z.string() }),
    }) {
      constructor(private readonly authContext: AuthContext) {
        super();
      }

      execute() {
        return Promise.resolve({
          userId: this.authContext.user?.id ?? "unknown",
        });
      }
    }

    @Can("manage", AdminSettings)
    @Injectable()
    class RotateSystemSecretTool extends BaseTool({
      description: "Rotates production system secrets (admin only)",
      inputSchema: z.object({ reason: z.string().min(5) }),
      outputSchema: z.object({ rotated: z.boolean() }),
    }) {
      execute(input: { reason: string }) {
        adminExecuteSpy(input);
        return Promise.resolve({ rotated: true });
      }
    }

    @Injectable()
    class UpdateArticleTool extends BaseTool({
      description: "Updates an article owned by the current user",
      inputSchema: z.object({
        articleId: z.string().min(3),
        title: z.string().default("Untitled Revision"),
      }),
      outputSchema: z.object({
        id: z.string(),
        title: z.string(),
        note: z.string().optional(),
      }),
      requestContextSchema: z.object({
        note: z.string().optional(),
      }),
    }) {
      constructor(private readonly articles: ArticleRepository) {
        super();
      }

      @Can(
        "update",
        (
          self: UpdateArticleTool,
          input: ToolInput<UpdateArticleTool>,
          ctx: ToolContext<UpdateArticleTool>,
        ) => {
          dynamicSubjectSpy(input, Boolean(ctx?.requestContext));
          return self.articles.findById(input.articleId);
        },
      )
      execute(
        input: ToolInput<UpdateArticleTool>,
        context?: ToolContext<UpdateArticleTool>,
      ) {
        updateExecuteSpy(input);
        return Promise.resolve({
          id: input.articleId,
          title: input.title,
          note: context?.requestContext.get("note"),
        });
      }
    }

    @Public()
    @UseGuards(TransientBetaFeatureGuard)
    @Injectable()
    class BetaMetricsTool extends BaseTool({
      description: "Reads beta metrics gated by server-side feature flag",
      outputSchema: z.object({ metrics: z.number() }),
    }) {
      execute() {
        return Promise.resolve({ metrics: 42 });
      }
    }

    @Can("manage", AdminSettings)
    @Injectable()
    class DirectMastraAdminTool extends MastraTool<
      { ping: string },
      { pong: string }
    > {
      constructor() {
        super({
          id: "direct-mastra-admin-tool",
          description: "Direct Mastra Tool subclass protected by @Can",
          inputSchema: z.object({ ping: z.string() }),
          outputSchema: z.object({ pong: z.string() }),
          execute: ({ ping }) => Promise.resolve({ pong: ping }),
        });
      }
    }

    const plainFunctionalTool = createTool({
      id: "plain-functional-tool",
      description: "Plain createTool helper without NestJS class decorators",
      execute: () => Promise.resolve({ plain: true }),
    });

    const recordedModelTools: string[][] = [];
    const mockModel = {
      specificationVersion: "v2" as const,
      provider: "mock",
      modelId: "mock-model",
      supportedUrls: {},
      doGenerate: vi.fn((options: { tools?: { name: string }[] }) => {
        recordedModelTools.push((options.tools ?? []).map((t) => t.name));
        return Promise.resolve({
          content: [{ type: "text" as const, text: "done" }],
          finishReason: "stop" as const,
          usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 },
          warnings: [],
        });
      }),
      doStream: vi.fn(),
    };

    @Injectable()
    class EditorialAssistantAgent extends BaseAgent {
      constructor(
        publicHealth: PublicHealthTool,
        whoAmI: WhoAmITool,
        rotateSecret: RotateSystemSecretTool,
        updateArticle: UpdateArticleTool,
        betaMetrics: BetaMetricsTool,
        directAdmin: DirectMastraAdminTool,
      ) {
        super({
          name: "Editorial Assistant",
          instructions: "Assist editors within their permissions.",
          model: mockModel,
          tools: {
            publicHealth,
            whoAmI,
            rotateSecret,
            updateArticle,
            betaMetrics,
            directAdmin,
            plainFunctional: plainFunctionalTool,
          },
        });
      }
    }

    @Injectable()
    class DirectSubclassedAgent extends MastraAgent {
      constructor(
        publicHealth: PublicHealthTool,
        rotateSecret: RotateSystemSecretTool,
      ) {
        super({
          id: "direct-subclassed-agent",
          name: "Direct Subclassed Agent",
          instructions: "Raw MastraAgent subclass.",
          model: mockModel,
          tools: ({ requestContext }) => ({
            publicHealth,
            rotateSecret,
            ...(requestContext.get("extra") === true
              ? { plainFunctional: plainFunctionalTool }
              : {}),
          }),
        });
      }
    }

    @Module({
      providers: [
        ArticleRepository,
        ServerFeatureFlagService,
        PublicHealthTool,
        WhoAmITool,
        RotateSystemSecretTool,
        UpdateArticleTool,
        BetaMetricsTool,
        DirectMastraAdminTool,
        EditorialAssistantAgent,
        DirectSubclassedAgent,
      ],
      exports: [
        ServerFeatureFlagService,
        PublicHealthTool,
        WhoAmITool,
        RotateSystemSecretTool,
        UpdateArticleTool,
        BetaMetricsTool,
        DirectMastraAdminTool,
        EditorialAssistantAgent,
        DirectSubclassedAgent,
      ],
    })
    class EditorialModule {}

    const RequestContextMod = resolveRequestContextModule();
    const requestContextInterceptorToken = (
      Reflect.getMetadata("providers", RequestContextMod) as {
        provide?: unknown;
        useClass?: Type<NestInterceptor>;
      }[]
    ).find((p) => p.provide === APP_INTERCEPTOR)?.useClass;
    if (!requestContextInterceptorToken) {
      throw new Error(
        "Expected RequestContextInterceptor on RequestContextModule",
      );
    }

    @Global()
    @Module({
      providers: createAuthGuardProviders(),
      exports: [AuthContext, AuthGuard],
    })
    class TestAuthModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [
        RequestContextMod,
        TestAuthModule,
        MastraModule.forRoot(),
        EditorialModule,
      ],
      providers: [
        { provide: APP_INTERCEPTOR, useClass: GlobalSpyInterceptor },
        { provide: APP_FILTER, useClass: GlobalSpyFilter },
      ],
    }).compile();

    await moduleRef.init();

    try {
      const manager = moduleRef.get(MastraManager);
      const mastra = moduleRef.get(Mastra);
      const authContext = moduleRef.get(AuthContext);
      const featureFlags = moduleRef.get(ServerFeatureFlagService);
      const requestContextInterceptor = new requestContextInterceptorToken(
        moduleRef.get(ModuleRef),
      );
      const agent = moduleRef.get(EditorialAssistantAgent);
      const directAgent = moduleRef.get(DirectSubclassedAgent);
      const publicTool = moduleRef.get(PublicHealthTool);
      const whoAmITool = moduleRef.get(WhoAmITool);
      const adminTool = moduleRef.get(RotateSystemSecretTool);
      const updateArticleTool = moduleRef.get(UpdateArticleTool);
      const betaMetricsTool = moduleRef.get(BetaMetricsTool);
      const directAdminTool = moduleRef.get(DirectMastraAdminTool);

      expect(manager.getTool("public-health-tool")).toBe(publicTool);
      expect(manager.getTool("rotate-system-secret-tool")).toBe(adminTool);
      expect(mastra.getToolById("update-article-tool")).toBe(updateArticleTool);
      expect(await manager.canAccessTool("missing-tool")).toBe(false);

      // 1. Unauthenticated caller: exposure filtering hides protected tools and transient guard with HttpException(403)
      await runWithAuthIdentity(
        requestContextInterceptor,
        authContext,
        null,
        async () => {
          featureFlags.enabledForBeta = false;
          const anonymousTools = await agent.listTools();
          expect(Object.keys(anonymousTools)).toEqual([
            "publicHealth",
            "plainFunctional",
          ]);

          featureFlags.enabledForBeta = true;
          const withBetaTools = await agent.listTools();
          expect(Object.keys(withBetaTools)).toEqual([
            "publicHealth",
            "betaMetrics",
            "plainFunctional",
          ]);
          featureFlags.enabledForBeta = false;

          expect(await publicTool.execute()).toEqual({ status: "ok" });
          await expect(whoAmITool.execute()).rejects.toThrow(
            UnauthorizedException,
          );
          // Even invalid input ("x" < min(5)) throws 401 before schema validation leaks field details
          await expect(adminTool.execute({ reason: "x" })).rejects.toThrow(
            UnauthorizedException,
          );
          expect(adminExecuteSpy).not.toHaveBeenCalled();

          await expect(betaMetricsTool.execute()).rejects.toThrow(
            HttpException,
          );
          featureFlags.enabledForBeta = true;
          expect(await betaMetricsTool.execute()).toEqual({ metrics: 42 });
          featureFlags.enabledForBeta = false;
        },
      );

      expect(featureFlags.seenContextTypes).toContain(
        MASTRA_TOOL_DISCOVERY_CONTEXT_TYPE,
      );
      expect(featureFlags.seenContextTypes).toContain(
        MASTRA_TOOL_EXECUTION_CONTEXT_TYPE,
      );

      interceptorSpy.mockClear();

      // 2. Regular editor (authenticated, owns "art-own", NOT admin)
      await runWithAuthIdentity(
        requestContextInterceptor,
        authContext,
        {
          userId: "user-1",
          permissions: ["article:read", "article:update:own"],
        },
        async () => {
          dynamicSubjectSpy.mockClear();
          const editorTools = await agent.listTools();
          expect(Object.keys(editorTools)).toEqual([
            "publicHealth",
            "whoAmI",
            "updateArticle",
            "plainFunctional",
          ]);
          expect(dynamicSubjectSpy).not.toHaveBeenCalled();

          const extraCtx = new MastraRequestContext();
          extraCtx.set("extra", true);
          expect(
            Object.keys(
              await directAgent.listTools({ requestContext: extraCtx }),
            ),
          ).toEqual(["publicHealth", "plainFunctional"]);

          const forked = (
            agent as unknown as { __fork: () => MastraAgent }
          ).__fork();
          expect(Object.keys(await forked.listTools())).toEqual([
            "publicHealth",
            "whoAmI",
            "updateArticle",
            "plainFunctional",
          ]);

          recordedModelTools.length = 0;
          await agent.generate("Check my tools");
          expect(recordedModelTools[0]).toEqual(
            expect.arrayContaining([
              "publicHealth",
              "whoAmI",
              "updateArticle",
              "plainFunctional",
            ]),
          );
          expect(recordedModelTools[0]).not.toContain("rotateSecret");
          expect(recordedModelTools[0]).not.toContain("directAdmin");
          expect(recordedModelTools[0]).not.toContain("betaMetrics");

          // Input validation runs before dynamic @Can callback for accessible tools
          const invalidRes = await updateArticleTool.execute({
            articleId: "x",
            title: "Too Short Id",
          });
          expect(isValidationError(invalidRes)).toBe(true);
          expect(dynamicSubjectSpy).not.toHaveBeenCalled();

          // Hidden admin tool throws ForbiddenException BEFORE schema validation even on invalid input
          await expect(adminTool.execute({ reason: "x" })).rejects.toThrow(
            ForbiddenException,
          );
          await expect(
            directAdminTool.execute?.({ ping: "secret" }),
          ).rejects.toThrow(ForbiddenException);
          expect(adminExecuteSpy).not.toHaveBeenCalled();

          const noteCtx = new MastraRequestContext();
          noteCtx.set("note", "editorial-note");
          const ownResult = await updateArticleTool.execute(
            { articleId: "art-own" } as ToolInput<UpdateArticleTool>,
            {
              requestContext: noteCtx,
            } as ToolContext<UpdateArticleTool>,
          );
          expect(ownResult).toEqual({
            id: "art-own",
            title: "Untitled Revision",
            note: "editorial-note",
          });
          expect(dynamicSubjectSpy).toHaveBeenCalledWith(
            { articleId: "art-own", title: "Untitled Revision" },
            true,
          );
          expect(updateExecuteSpy).toHaveBeenCalledTimes(1);

          await expect(
            updateArticleTool.execute({
              articleId: "art-other",
              title: "Hijack",
            }),
          ).rejects.toThrow(ForbiddenException);
          expect(updateExecuteSpy).toHaveBeenCalledTimes(1);

          const accessibleIds = (await manager.getAccessibleTools()).map(
            (t) => t.id,
          );
          expect(accessibleIds).toContain("public-health-tool");
          expect(accessibleIds).toContain("who-am-i-tool");
          expect(accessibleIds).toContain("update-article-tool");
          expect(accessibleIds).not.toContain("rotate-system-secret-tool");
          expect(accessibleIds).not.toContain("direct-mastra-admin-tool");
        },
      );

      // 3. Admin user sees and executes admin tools; filterAccessibleTools returns Partial<TTools>
      await runWithAuthIdentity(
        requestContextInterceptor,
        authContext,
        {
          userId: "admin-1",
          permissions: ["admin:manage", "article:read"],
        },
        async () => {
          const adminTools = await agent.listTools();
          expect(Object.keys(adminTools)).toEqual(
            expect.arrayContaining([
              "publicHealth",
              "whoAmI",
              "rotateSecret",
              "directAdmin",
            ]),
          );
          expect(await whoAmITool.execute()).toEqual({
            userId: "admin-1",
          });
          expect(await adminTool.execute({ reason: "scheduled" })).toEqual({
            rotated: true,
          });
          expect(await directAdminTool.execute?.({ ping: "ok" })).toEqual({
            pong: "ok",
          });
          expect(adminExecuteSpy).toHaveBeenCalledTimes(1);

          const filteredCustomMap = await filterAccessibleTools({
            adminTool,
            betaMetricsTool,
          });
          expectTypeOf(filteredCustomMap).toEqualTypeOf<{
            adminTool?: RotateSystemSecretTool;
            betaMetricsTool?: BetaMetricsTool;
          }>();
          expect(Object.keys(filteredCustomMap)).toEqual(["adminTool"]);
        },
      );

      expect(interceptorSpy).not.toHaveBeenCalled();
      expect(filterSpy).not.toHaveBeenCalled();
    } finally {
      await moduleRef.close();
    }
  });

  it("validates singleton scope, duplicate IDs/keys, raw tool dynamic @Can, cross-container reuse, unbound guards, and unexpected guard errors", async () => {
    // 1. Non-singleton tool provider is rejected
    @Injectable({ scope: Scope.REQUEST })
    class RequestScopedTool extends BaseTool({
      description: "Invalid request-scoped tool",
    }) {
      execute() {
        return Promise.resolve({});
      }
    }

    const scopedRef = await Test.createTestingModule({
      imports: [MastraModule.forRoot()],
      providers: [RequestScopedTool],
    }).compile();

    try {
      await expect(scopedRef.init()).rejects.toThrow(
        /must be a singleton Mastra Tool provider/,
      );
    } finally {
      await scopedRef.close().catch(() => undefined);
    }

    // 2. Registration-key collision with a preconfigured tool of different intrinsic id is rejected
    const conflictingPreconfigured = createTool({
      id: "intrinsic-other-id",
      description: "Occupies colliding-tool key",
      execute: () => Promise.resolve({}),
    });

    @Injectable()
    class CollidingTool extends BaseTool({
      id: "colliding-tool",
      description: "Provider whose id collides with preconfigured map key",
    }) {
      execute() {
        return Promise.resolve({});
      }
    }

    const keyCollisionRef = await Test.createTestingModule({
      imports: [
        MastraModule.forRoot({
          tools: {
            "colliding-tool": conflictingPreconfigured,
          },
        }),
      ],
      providers: [CollidingTool],
    }).compile();

    try {
      await expect(keyCollisionRef.init()).rejects.toThrow(
        /collides with an existing tool registered under key "colliding-tool"/,
      );
    } finally {
      await keyCollisionRef.close().catch(() => undefined);
    }

    // 3. Raw MastraTool with dynamic @Can callback fails closed at startup
    @Can("update", () => Article)
    @Injectable()
    class RawDynamicCanTool extends MastraTool {
      constructor() {
        super({
          id: "raw-dynamic-can-tool",
          description: "Raw tool with dynamic callback",
          execute: () => Promise.resolve({}),
        });
      }
    }

    const rawCanRef = await Test.createTestingModule({
      imports: [MastraModule.forRoot()],
      providers: [RawDynamicCanTool],
    }).compile();

    try {
      await expect(rawCanRef.init()).rejects.toThrow(
        /Extend "BaseTool\(\.\.\.\)" instead/,
      );
    } finally {
      await rawCanRef.close().catch(() => undefined);
    }

    // 4. Reusing a preconfigured BaseTool across two concurrently active containers fails closed,
    //    then succeeds cleanly once the first container shuts down.
    class SharedAdHocTool extends BaseTool({
      description: "Shared tool instance",
      outputSchema: z.object({ ok: z.boolean() }),
    }) {
      execute() {
        return Promise.resolve({ ok: true });
      }
    }
    const sharedTool = new SharedAdHocTool();

    const app1 = await Test.createTestingModule({
      imports: [
        MastraModule.forRoot({
          tools: { sharedTool },
        }),
      ],
    }).compile();
    await app1.init();

    await expect(
      Test.createTestingModule({
        imports: [
          MastraModule.forRoot({
            tools: { sharedTool },
          }),
        ],
      }).compile(),
    ).rejects.toThrow(/already bound to another active NestJS container/);

    await app1.close();

    const app2AfterClose = await Test.createTestingModule({
      imports: [
        MastraModule.forRoot({
          tools: { sharedTool },
        }),
      ],
      providers: [
        {
          provide: APP_GUARD,
          useValue: { canActivate: () => false },
        },
      ],
    }).compile();
    await app2AfterClose.init();
    try {
      await expect(sharedTool.execute()).rejects.toThrow(ForbiddenException);
    } finally {
      await app2AfterClose.close();
    }

    // 5. Unbound class guard on a `useFactory` tool provider fails closed at startup
    @Injectable()
    class UnregisteredClassGuard implements CanActivate {
      canActivate(): boolean {
        return false;
      }
    }

    @UseGuards(UnregisteredClassGuard)
    class FactoryCreatedTool extends BaseTool({
      description:
        "Created via useFactory so Nest scanner did not bind class guard",
    }) {
      execute() {
        return Promise.resolve({});
      }
    }

    const unboundGuardRef = await Test.createTestingModule({
      imports: [MastraModule.forRoot()],
      providers: [
        {
          provide: "FACTORY_TOOL",
          useFactory: () => new FactoryCreatedTool(),
        },
      ],
    }).compile();

    try {
      await expect(unboundGuardRef.init()).rejects.toThrow(
        /references guard "UnregisteredClassGuard" by class/,
      );
    } finally {
      await unboundGuardRef.close().catch(() => undefined);
    }

    // 6. Unexpected non-auth Error inside a guard propagates during discovery
    class CrashingGuard implements CanActivate {
      canActivate(): boolean {
        throw new TypeError("Unexpected guard bug");
      }
    }

    @UseGuards(new CrashingGuard())
    @Injectable()
    class CrashingTool extends BaseTool({
      description: "Tool with buggy guard instance",
    }) {
      execute() {
        return Promise.resolve({});
      }
    }

    const crashingRef = await Test.createTestingModule({
      imports: [MastraModule.forRoot()],
      providers: [CrashingTool],
    }).compile();

    await crashingRef.init();
    try {
      const manager = crashingRef.get(MastraManager);
      await expect(manager.getAccessibleTools()).rejects.toThrow(
        "Unexpected guard bug",
      );
    } finally {
      await crashingRef.close();
    }
  });

  it("covers custom-token host module guards, raw tool context forwarding, class-field listTools overrides, agent container isolation, startup rollback, shutdown drain ordering, non-enumerable DI fields, and weak ad-hoc tool tracking", async () => {
    @Injectable()
    class CircularSecretDependency {
      readonly apiSecret = "super-secret-token";
      readonly self: CircularSecretDependency = this;
    }

    @Injectable()
    class ServerAuthScopeService {
      authorizedTenant: string | null = null;
    }

    @Injectable()
    class ExecutionGateGuard implements CanActivate {
      constructor(private readonly authScope: ServerAuthScopeService) {}

      canActivate(context: ExecutionContext): boolean {
        if (context.getType<string>() === MASTRA_TOOL_DISCOVERY_CONTEXT_TYPE) {
          return true;
        }
        const [, toolCtx] =
          context.getArgs<
            [unknown, { requestContext?: MastraRequestContext } | undefined]
          >();
        const requestedTenant = toolCtx?.requestContext?.get("requestedTenant");
        return (
          this.authScope.authorizedTenant !== null &&
          requestedTenant === this.authScope.authorizedTenant
        );
      }
    }

    const CUSTOM_TOKEN = Symbol("CUSTOM_GUARDED_TOOL");

    @UseGuards(ExecutionGateGuard)
    @Injectable()
    class CustomTokenGuardedTool extends BaseTool({
      description:
        "Registered under a custom DI token with a module-local guard",
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ echoed: z.string() }),
    }) {
      constructor(private readonly secretDep: CircularSecretDependency) {
        super();
      }

      execute(
        { value }: { value: string },
        _context?: ToolContext<CustomTokenGuardedTool>,
      ) {
        return Promise.resolve({
          echoed: `${value}:${this.secretDep.self ? "ok" : "missing"}`,
        });
      }
    }

    const rawGuardCapturedArgs: unknown[][] = [];

    @Injectable()
    class RawToolContextGuard implements CanActivate {
      constructor(private readonly authScope: ServerAuthScopeService) {}

      canActivate(context: ExecutionContext): boolean {
        if (context.getType<string>() === MASTRA_TOOL_DISCOVERY_CONTEXT_TYPE) {
          return true;
        }
        rawGuardCapturedArgs.push([...context.getArgs()]);
        const [, toolCtx] =
          context.getArgs<
            [unknown, { requestContext?: MastraRequestContext } | undefined]
          >();
        return (
          this.authScope.authorizedTenant !== null &&
          toolCtx?.requestContext?.get("tenant") ===
            this.authScope.authorizedTenant
        );
      }
    }

    @UseGuards(RawToolContextGuard)
    @Injectable()
    class RawContextProtectedTool extends MastraTool<
      { query: string },
      { tenantQuery: string }
    > {
      constructor(private readonly secretDep: CircularSecretDependency) {
        super({
          id: "raw-context-protected-tool",
          description: "Raw MastraTool reading requestContext in @UseGuards",
          inputSchema: z.object({ query: z.string() }),
          outputSchema: z.object({ tenantQuery: z.string() }),
          execute: ({ query }, ctx) =>
            Promise.resolve({
              tenantQuery: `${String(ctx.requestContext.get("tenant"))}:${query}:${this.secretDep ? "ok" : "missing"}`,
            }),
        });
      }
    }

    class EphemeralDynamicTool extends BaseTool({
      description: "Created per listTools call",
      outputSchema: z.object({ reqId: z.string() }),
    }) {
      @UseGuards({
        canActivate: (ctx: ExecutionContext) =>
          ctx.getType<string>() !== MASTRA_TOOL_DISCOVERY_CONTEXT_TYPE
            ? false
            : true,
      })
      execute() {
        return Promise.resolve({ reqId: "ephemeral" });
      }
    }

    @UseGuards({ canActivate: () => false })
    class HiddenAdHocTool extends BaseTool({
      description: "Always hidden ad-hoc tool",
    }) {
      execute() {
        return Promise.resolve({});
      }
    }

    @Injectable()
    class ClassFieldOverrideAgent extends BaseAgent {
      constructor() {
        super({
          name: "Class Field Override Agent",
          instructions: "Overrides listTools via class property.",
          model: "openai/gpt-4o-mini",
        });
      }

      override listTools = () =>
        Promise.resolve({
          ephemeral: new EphemeralDynamicTool(),
          hidden: new HiddenAdHocTool(),
        });
    }

    @Module({
      providers: [
        CircularSecretDependency,
        ServerAuthScopeService,
        ExecutionGateGuard,
        RawToolContextGuard,
        {
          provide: CUSTOM_TOKEN,
          useClass: CustomTokenGuardedTool,
        },
        RawContextProtectedTool,
        ClassFieldOverrideAgent,
      ],
      exports: [
        ServerAuthScopeService,
        CUSTOM_TOKEN,
        RawContextProtectedTool,
        ClassFieldOverrideAgent,
      ],
    })
    class IsolatedFeatureModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [MastraModule.forRoot(), IsolatedFeatureModule],
    }).compile();

    await moduleRef.init();

    let guardCheckedDuringShutdownDrain = false;
    const mastra = moduleRef.get(Mastra);
    const authScope = moduleRef.get(ServerAuthScopeService);
    const customTool = moduleRef.get<CustomTokenGuardedTool>(CUSTOM_TOKEN);
    const rawTool = moduleRef.get(RawContextProtectedTool);
    const fieldOverrideAgent = moduleRef.get(ClassFieldOverrideAgent);
    const manager = moduleRef.get(MastraManager);

    const originalMastraShutdown = mastra.shutdown.bind(mastra);
    vi.spyOn(mastra, "shutdown").mockImplementation(async () => {
      // Guards must remain installed while Mastra drains in-flight work
      authScope.authorizedTenant = null;
      await expect(customTool.execute({ value: "drain" })).rejects.toThrow(
        ForbiddenException,
      );
      guardCheckedDuringShutdownDrain = true;
      await originalMastraShutdown();
    });

    try {
      // Injected circular dependency is non-enumerable: spreading and JSON.stringify succeed without leaking
      expect(Object.keys({ ...customTool })).not.toContain("secretDep");
      expect(Object.keys({ ...rawTool })).not.toContain("secretDep");
      expect(() => JSON.stringify({ ...customTool })).not.toThrow();
      expect(JSON.stringify({ ...customTool })).not.toContain(
        "super-secret-token",
      );

      // Custom-token tool resolves module-local ExecutionGateGuard in BOTH discovery and execution;
      // client-supplied requestContext alone cannot grant access without server-side authorization
      expect(await manager.canAccessTool("custom-token-guarded-tool")).toBe(
        true,
      );
      const clientTenantCtx = new MastraRequestContext();
      clientTenantCtx.set("requestedTenant", "acme");
      await expect(
        customTool.execute({ value: "spoofed" }, {
          requestContext: clientTenantCtx,
        } as ToolContext<CustomTokenGuardedTool>),
      ).rejects.toThrow(ForbiddenException);

      authScope.authorizedTenant = "acme";
      expect(
        await customTool.execute({ value: "allowed" }, {
          requestContext: clientTenantCtx,
        } as ToolContext<CustomTokenGuardedTool>),
      ).toEqual({ echoed: "allowed:ok" });

      // Raw MastraTool withholds raw input (args[0] === undefined) while forwarding execution context (args[1])
      authScope.authorizedTenant = null;
      const acmeCtx = new MastraRequestContext();
      acmeCtx.set("tenant", "acme");
      await expect(
        rawTool.execute?.({ query: "untrusted" }, { requestContext: acmeCtx }),
      ).rejects.toThrow(ForbiddenException);
      expect(rawGuardCapturedArgs[0]?.[0]).toBeUndefined();

      authScope.authorizedTenant = "acme";
      expect(
        await rawTool.execute?.(
          { query: "hello" },
          { requestContext: acmeCtx },
        ),
      ).toEqual({ tenantQuery: "acme:hello:ok" });
      expect(rawGuardCapturedArgs[1]?.[0]).toBeUndefined();
      expect(
        (
          rawGuardCapturedArgs[1]?.[1] as {
            requestContext?: MastraRequestContext;
          }
        )?.requestContext,
      ).toBe(acmeCtx);

      // Removing a tool from Mastra immediately reflects in MastraManager lookups (no stale cache)
      expect(
        manager.getToolByRegistrationKey("raw-context-protected-tool"),
      ).toBe(rawTool);
      mastra.removeTool("raw-context-protected-tool");
      expect(
        manager.getToolByRegistrationKey("raw-context-protected-tool"),
      ).toBeUndefined();
      expect(manager.getTool("raw-context-protected-tool")).toBeUndefined();

      // Class-field listTools override is re-wrapped by MastraManager: filters hidden tools and binds ad-hoc tools weakly
      const resolvedOverrideTools = await fieldOverrideAgent.listTools();
      expect(Object.keys(resolvedOverrideTools)).toEqual(["ephemeral"]);
      await expect(resolvedOverrideTools.ephemeral?.execute()).rejects.toThrow(
        ForbiddenException,
      );

      for (let i = 0; i < 5; i++) {
        await fieldOverrideAgent.listTools();
      }
      const internalManager = manager as unknown as {
        boundToolRefs: Set<WeakRef<object>>;
      };
      expect(internalManager.boundToolRefs).toBeInstanceOf(Set);
      for (const ref of internalManager.boundToolRefs) {
        expect(ref).toBeInstanceOf(WeakRef);
      }
    } finally {
      await moduleRef.close();
    }

    expect(guardCheckedDuringShutdownDrain).toBe(true);

    // Shared preconfigured Agent with dynamic tool resolver cannot have its binder or #mastra hijacked
    // by a second active container; startup rollback cleans Mastra registry and releases bindings;
    // runtime mastra.addTool, forked agent revocation, and in-flight calls during close() stay guarded.
    class DynamicSharedTool extends BaseTool({
      description: "Dynamically instantiated tool",
      outputSchema: z.object({ ok: z.boolean() }),
    }) {
      execute() {
        return Promise.resolve({ ok: true });
      }
    }

    let seenResolverMastra: unknown;
    const sharedDynamicAgent = new MastraAgent({
      id: "shared-dynamic-agent",
      name: "Shared Dynamic Agent",
      instructions: "Resolves dynamic tools.",
      model: "openai/gpt-4o-mini",
      tools: ({ mastra: agentMastra }) => {
        seenResolverMastra = agentMastra;
        return {
          dynamicTool: new DynamicSharedTool(),
        };
      },
    });
    const sharedRollbackTool = new DynamicSharedTool();
    const sharedLateForkTool = new DynamicSharedTool();

    @Injectable()
    class DiscoveredBeforeFailureTool extends BaseTool({
      description: "Added to Mastra before agent validation throws",
    }) {
      execute() {
        return Promise.resolve({});
      }
    }

    @Injectable({ scope: Scope.REQUEST })
    class InvalidRequestScopedAgent extends BaseAgent {
      constructor() {
        super({
          name: "Invalid Request Scoped Agent",
          instructions: "Triggers init failure after preconfigured bindings.",
          model: "openai/gpt-4o-mini",
        });
      }
    }

    const failedInitRef = await Test.createTestingModule({
      imports: [
        MastraModule.forRoot({
          tools: { sharedRollbackTool },
          agents: { sharedDynamicAgent },
        }),
      ],
      providers: [DiscoveredBeforeFailureTool, InvalidRequestScopedAgent],
    }).compile();

    // Intentionally do NOT call failedInitRef.close() first: failed onModuleInit must roll back bindings AND Mastra additions
    await expect(failedInitRef.init()).rejects.toThrow(
      /must be a singleton Mastra Agent provider/,
    );
    expect(Object.keys(failedInitRef.get(Mastra).listTools() ?? {})).toEqual([
      "sharedRollbackTool",
    ]);

    const ownerApp1 = await Test.createTestingModule({
      imports: [
        MastraModule.forRoot({
          tools: { sharedRollbackTool },
          agents: { sharedDynamicAgent },
        }),
      ],
      providers: [
        {
          provide: APP_GUARD,
          useValue: { canActivate: () => true },
        },
      ],
    }).compile();
    await ownerApp1.init();

    const ownerMastra1 = ownerApp1.get(Mastra);
    const ownerManager1 = ownerApp1.get(MastraManager);

    // Runtime mastra.addTool after onModuleInit binds exposure and execution guards automatically
    @UseGuards({ canActivate: () => false })
    class RuntimeAddedDeniedTool extends BaseTool({
      id: "runtime-added-denied-tool",
      description: "Added at runtime via mastra.addTool",
    }) {
      execute() {
        return Promise.resolve({ secret: true });
      }
    }
    const runtimeDeniedTool = new RuntimeAddedDeniedTool();
    ownerMastra1.addTool(runtimeDeniedTool);
    expect(await ownerManager1.canAccessTool("runtime-added-denied-tool")).toBe(
      false,
    );
    await expect(runtimeDeniedTool.execute()).rejects.toThrow(
      ForbiddenException,
    );

    // Prepare an in-flight BaseTool.execute call that pauses in discovery while ownerApp1 closes,
    // and then must STILL enforce its execution-time guard!
    let releaseDiscoveryGate!: () => void;
    const discoveryGate = new Promise<void>((resolve) => {
      releaseDiscoveryGate = resolve;
    });
    let markDiscoveryEntered!: () => void;
    const discoveryEntered = new Promise<void>((resolve) => {
      markDiscoveryEntered = resolve;
    });

    @UseGuards({
      canActivate: async (ctx: ExecutionContext) => {
        if (ctx.getType<string>() === MASTRA_TOOL_DISCOVERY_CONTEXT_TYPE) {
          markDiscoveryEntered();
          await discoveryGate;
          return true;
        }
        return false;
      },
    })
    class InFlightCloseGuardedTool extends BaseTool({
      id: "in-flight-close-guarded-tool",
      description:
        "Tests in-flight execution guard preservation across close()",
    }) {
      execute() {
        return Promise.resolve({ bypassed: true });
      }
    }
    const inFlightTool = new InFlightCloseGuardedTool();
    ownerMastra1.addTool(inFlightTool);

    const retainedForkAgent = new MastraAgent({
      id: "retained-fork-source",
      name: "Retained Fork Source",
      instructions: "Tests fork binder revocation.",
      model: "openai/gpt-4o-mini",
      tools: () => ({ lateTool: sharedLateForkTool }),
    });
    ownerMastra1.addAgent(retainedForkAgent);
    const retainedFork = (
      retainedForkAgent as unknown as { __fork: () => MastraAgent }
    ).__fork();

    let inFlightPromise: Promise<unknown> | undefined;
    try {
      // Competing container fails BEFORE new Mastra(...) can overwrite sharedDynamicAgent's #mastra reference
      await expect(
        Test.createTestingModule({
          imports: [
            MastraModule.forRoot({
              agents: { sharedDynamicAgent },
            }),
          ],
          providers: [
            {
              provide: APP_GUARD,
              useValue: { canActivate: () => false },
            },
          ],
        }).compile(),
      ).rejects.toThrow(
        /Mastra agent "shared-dynamic-agent".*already bound to another active NestJS container/,
      );

      seenResolverMastra = undefined;
      const app1Tools = await sharedDynamicAgent.listTools();
      expect(Object.keys(app1Tools)).toEqual(["dynamicTool"]);
      expect(seenResolverMastra).toBe(ownerMastra1);

      inFlightPromise = inFlightTool.execute();
      await discoveryEntered;
    } finally {
      await ownerApp1.close();
      await failedInitRef.close().catch(() => undefined);
    }

    // Release discovery gate AFTER ownerApp1.close() unbound inFlightTool: in-flight call must STILL run execution guard!
    releaseDiscoveryGate();
    await expect(inFlightPromise).rejects.toThrow(ForbiddenException);

    // Retained fork's binder was revoked on ownerApp1.close(), so calling listTools() does NOT bind sharedLateForkTool to closed app1
    await retainedFork.listTools();

    // Once ownerApp1 closes, both sharedDynamicAgent and sharedLateForkTool bind cleanly to a new container
    const ownerApp3 = await Test.createTestingModule({
      imports: [
        MastraModule.forRoot({
          tools: { sharedLateForkTool },
          agents: { sharedDynamicAgent },
        }),
      ],
      providers: [
        {
          provide: APP_GUARD,
          useValue: { canActivate: () => false },
        },
      ],
    }).compile();
    await ownerApp3.init();
    try {
      expect(Object.keys(await sharedDynamicAgent.listTools())).toEqual([]);
      await expect(sharedLateForkTool.execute()).rejects.toThrow(
        ForbiddenException,
      );
    } finally {
      await ownerApp3.close();
    }
  });

  it("covers helper edge cases including nested execution, empty tool maps, non-tool inputs, and request-scoped APP_GUARD rejection", async () => {
    expect(isClassBasedMastraTool(null)).toBe(false);
    expect(await canExposeMastraTool(null)).toBe(true);
    await expect(assertCanExposeMastraTool(null)).resolves.toBeUndefined();
    await expect(
      assertCanExposeMastraTool({
        [CAN_EXPOSE_TOOL]: () => Promise.resolve(false),
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(await filterAccessibleTools({})).toEqual({});

    assertMastraPrimitivesAvailable({
      tools: { empty: null },
      agents: { empty: null },
    });

    const plainTool = createTool({
      id: "plain-helper-tool",
      description: "Plain tool",
      execute: () => Promise.resolve({ ok: true }),
    });
    concealToolInstanceDependencies(plainTool);

    // Function guard with static .canActivate method and render-only tool fallback
    const callableGuardObject = Object.assign(() => true, {
      canActivate: () => true,
    });

    @UseGuards(callableGuardObject)
    class RenderOnlyCustomTool extends MastraTool {
      constructor() {
        super({
          id: "render-only-custom-tool",
          description: "Render-only tool without prototype execute",
          renderOnly: true,
        });
      }
    }
    const renderOnlyTool = new RenderOnlyCustomTool();
    const mockCreator = {} as never;
    bindToolGuards(renderOnlyTool, mockCreator);
    // Idempotent re-bind with same creator, and conflict on a different creator
    bindToolGuards(renderOnlyTool, mockCreator);
    expect(() => {
      bindToolGuards(renderOnlyTool, {} as never);
    }).toThrow(/already bound to another active NestJS container/);
    expect(await canExposeMastraTool(renderOnlyTool)).toBe(true);

    // Prototype execute resolution on a raw MastraTool subclass & Observable return on BaseTool
    class LeafNestedTool extends BaseTool({
      description: "Leaf tool returning an Observable",
      outputSchema: z.object({ leaf: z.boolean() }),
    }) {
      execute() {
        return from(Promise.resolve({ leaf: true })) as unknown as Promise<{
          leaf: boolean;
        }>;
      }
    }

    class OuterNestedTool extends BaseTool({
      description: "Outer tool invoking LeafNestedTool inside execute",
      outputSchema: z.object({ nested: z.boolean() }),
    }) {
      constructor(private readonly leaf: LeafNestedTool) {
        super();
      }

      async execute() {
        const res = await this.leaf.execute();
        return { nested: "leaf" in res && res.leaf };
      }
    }

    const nestedRef = await Test.createTestingModule({
      imports: [MastraModule.forRoot()],
      providers: [
        LeafNestedTool,
        {
          provide: OuterNestedTool,
          inject: [LeafNestedTool],
          useFactory: (leaf: LeafNestedTool) => new OuterNestedTool(leaf),
        },
      ],
    }).compile();
    await nestedRef.init();
    try {
      const outer = nestedRef.get(OuterNestedTool);
      // Re-invoking OuterNestedTool inside its own active delegate storage tests nested same-tool + cross-tool paths
      expect(await outer.execute()).toEqual({ nested: true });
    } finally {
      await nestedRef.close();
    }

    // wrapAgentToolDiscovery function overload
    const standaloneAgent = new MastraAgent({
      id: "standalone-fn-agent",
      name: "Standalone",
      instructions: "Test",
      model: "openai/gpt-4o-mini",
      tools: { leaf: new LeafNestedTool() },
    });
    const binderSpy = vi.fn();
    wrapAgentToolDiscovery(standaloneAgent, binderSpy);
    await standaloneAgent.listTools();
    expect(binderSpy).toHaveBeenCalledTimes(1);

    // Request-scoped APP_GUARD fails closed when binding an ad-hoc tool outside entryProviders
    @Injectable({ scope: Scope.REQUEST })
    class RequestScopedGlobalGuard implements CanActivate {
      canActivate(): boolean {
        return true;
      }
    }

    const scopedGlobalRef = await Test.createTestingModule({
      imports: [
        MastraModule.forRoot({
          tools: { adHocLeaf: new LeafNestedTool() },
        }),
      ],
      providers: [
        {
          provide: APP_GUARD,
          useClass: RequestScopedGlobalGuard,
        },
      ],
    }).compile();

    try {
      await expect(scopedGlobalRef.init()).rejects.toThrow(
        /cannot run request- or transient-scoped global guard/,
      );
    } finally {
      await scopedGlobalRef.close().catch(() => undefined);
    }
  });
});
