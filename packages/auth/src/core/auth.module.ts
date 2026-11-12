import { MikroORM } from "@mikro-orm/core";
import { DatabaseModule } from "@nest-boot/database";
import { HashService } from "@nest-boot/hash";
import { Mailer } from "@nest-boot/mailer";
import {
  type MiddlewareConfigurator,
  MiddlewareManager,
  MiddlewareModule,
} from "@nest-boot/middleware";
import {
  RequestContextMiddleware,
  RequestContextModule,
} from "@nest-boot/request-context";
import {
  type ConfigurableModuleAsyncOptions,
  type DynamicModule,
  Global,
  Inject,
  Module,
  type NestMiddleware,
} from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";

import { adminProviders } from "../admin/admin.providers.js";
import { SystemAccountService } from "../admin/services/system-account.service.js";
import { apiKeyProviders } from "../api-key/api-key.providers.js";
import { createApiKeySchema } from "../api-key/entities/api-key.entity-schema.js";
import { SystemAccount } from "../api-key/entities/system-account.entity.js";
import { ApiKeyUsageInterceptor } from "../api-key/interceptors/api-key-usage.interceptor.js";
import { SystemApiKeyService } from "../api-key/services/system-api-key.service.js";
import { UserApiKeyService } from "../api-key/services/user-api-key.service.js";
import { WorkspaceApiKeyService } from "../api-key/services/workspace-api-key.service.js";
import {
  DEFAULT_WORKSPACE_PERMISSIONS,
  DEFAULT_WORKSPACE_ROLES,
} from "../workspace/constants/workspace.constants.js";
import { Workspace } from "../workspace/entities/workspace.entity.js";
import { WorkspaceInvitation } from "../workspace/entities/workspace-invitation.entity.js";
import { WorkspaceMember } from "../workspace/entities/workspace-member.entity.js";
import { WorkspaceService } from "../workspace/services/workspace.service.js";
import { WorkspaceInvitationService } from "../workspace/services/workspace-invitation.service.js";
import { WorkspaceMemberService } from "../workspace/services/workspace-member.service.js";
import { workspaceProviders } from "../workspace/workspace.providers.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthMiddleware } from "./auth.middleware.js";
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./auth.module-definition.js";
import { AuthEnumRegistry } from "./auth-enum-registry.js";
import { AuthHandlerMiddleware } from "./auth-handler.middleware.js";
import { authServiceProviders } from "./auth-service.providers.js";
import { AUTH_TOKEN } from "./constants/auth.constants.js";
import {
  DEFAULT_USER_PERMISSIONS,
  DEFAULT_USER_ROLES,
} from "./constants/user.constants.js";
import { createAuthInstance } from "./create-auth-instance.js";
import { Account } from "./entities/account.entity.js";
import { Session } from "./entities/session.entity.js";
import { User } from "./entities/user.entity.js";
import { Verification } from "./entities/verification.entity.js";
import { type AuthModuleOptions } from "./interfaces/auth-module-options.interface.js";
import { AuthResolver } from "./resolvers/auth.resolver.js";
import { SessionResolver } from "./resolvers/session.resolver.js";
import { UserResolver } from "./resolvers/user.resolver.js";
import { AccountService } from "./services/account.service.js";
import { AuthService } from "./services/auth.service.js";
import { SessionService } from "./services/session.service.js";
import { UserService } from "./services/user.service.js";
import { UserDeletionService } from "./services/user-deletion.service.js";
import { resolveAuthFeatures } from "./utils/resolve-auth-features.util.js";

@Module({})
class AuthOptionsHostModule {}

/**
 * Authentication module based on better-auth.
 *
 * Provides authentication services including session management, middleware registration,
 * and MikroORM-based persistence via the better-auth adapter.
 */
@Global()
@Module({
  imports: [RequestContextModule, MiddlewareModule],
  providers: [
    {
      provide: AuthEnumRegistry,
      inject: [MODULE_OPTIONS_TOKEN, AUTH_TOKEN],
      useFactory: (options: AuthModuleOptions) => new AuthEnumRegistry(options),
    },
    AuthResolver,
    UserResolver,
    SessionResolver,
    ...authServiceProviders,
    ...adminProviders,
    ...apiKeyProviders,
    ...workspaceProviders,
    AccountService,
    ApiKeyUsageInterceptor,
    AuthService,
    UserDeletionService,
    AuthGuard,
    AuthHandlerMiddleware,
    AuthMiddleware,
    {
      provide: APP_INTERCEPTOR,
      useExisting: ApiKeyUsageInterceptor,
    },
    {
      provide: AUTH_TOKEN,
      inject: [
        MODULE_OPTIONS_TOKEN,
        MikroORM,
        Mailer,
        HashService,
        UserDeletionService,
      ],
      useFactory: createAuthInstance,
    },
  ],
  exports: [
    AccountService,
    SystemAccountService,
    SystemApiKeyService,
    UserService,
    UserApiKeyService,
    WorkspaceApiKeyService,
    AuthGuard,
    AuthService,
    SessionService,
    WorkspaceService,
    WorkspaceMemberService,
    WorkspaceInvitationService,
  ],
})
export class AuthModule extends ConfigurableModuleClass {
  /**
   * Registers the AuthModule with the given options.
   * @param options - Configuration options including secret and middleware settings
   * @returns Dynamic module configuration
   */
  static override forRoot<
    const UserPermission extends string =
      (typeof DEFAULT_USER_PERMISSIONS)[number],
    const WorkspacePermission extends string =
      (typeof DEFAULT_WORKSPACE_PERMISSIONS)[number],
    const UserRole extends string = keyof typeof DEFAULT_USER_ROLES,
    const WorkspaceRole extends string = keyof typeof DEFAULT_WORKSPACE_ROLES,
  >(
    options: AuthModuleOptions<
      UserPermission,
      WorkspacePermission,
      UserRole,
      WorkspaceRole
    >,
  ): DynamicModule {
    return this.createRootModule(
      super.forRoot(options as unknown as AuthModuleOptions),
    );
  }

  /**
   * Registers the AuthModule asynchronously with factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override forRootAsync<
    const UserPermission extends string =
      (typeof DEFAULT_USER_PERMISSIONS)[number],
    const WorkspacePermission extends string =
      (typeof DEFAULT_WORKSPACE_PERMISSIONS)[number],
    const UserRole extends string = keyof typeof DEFAULT_USER_ROLES,
    const WorkspaceRole extends string = keyof typeof DEFAULT_WORKSPACE_ROLES,
  >(
    options: ConfigurableModuleAsyncOptions<
      AuthModuleOptions<
        UserPermission,
        WorkspacePermission,
        UserRole,
        WorkspaceRole
      >
    >,
  ): DynamicModule {
    return this.createRootModule(
      super.forRootAsync(
        options as unknown as ConfigurableModuleAsyncOptions<AuthModuleOptions>,
      ),
    );
  }

  private static createRootModule(
    configurableModule: DynamicModule,
  ): DynamicModule {
    const optionsModule: DynamicModule = {
      module: AuthOptionsHostModule,
      imports: configurableModule.imports,
      providers: configurableModule.providers,
      exports: [MODULE_OPTIONS_TOKEN],
    };
    return {
      module: AuthModule,
      imports: [
        optionsModule,
        DatabaseModule.forFeatureAsync({
          imports: [optionsModule],
          inject: [MODULE_OPTIONS_TOKEN],
          useFactory: (options: AuthModuleOptions) => {
            const features = resolveAuthFeatures(options);
            return [
              User,
              Account,
              Session,
              Verification,
              ...(features.apiKey
                ? [
                    createApiKeySchema({
                      user: features.userApiKey,
                      workspace: features.workspaceApiKey,
                      system: features.systemApiKey,
                    }),
                  ]
                : []),
              ...(features.systemAccount ? [SystemAccount] : []),
              ...(features.workspace
                ? [Workspace, WorkspaceMember, WorkspaceInvitation]
                : []),
            ];
          },
        }),
      ],
      exports: [optionsModule],
    };
  }

  /**
   * Creates a new AuthModule instance.
   * @param options - Auth module configuration options
   * @param middlewareManager - Middleware manager for registering auth middleware
   * @param authHandlerMiddleware - The dependency-injected auth endpoint handler
   * @param authMiddleware - The auth middleware instance
   */
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
    private readonly middlewareManager: MiddlewareManager,
    @Inject(AuthHandlerMiddleware)
    private readonly authHandlerMiddleware: NestMiddleware,
    private readonly authMiddleware: AuthMiddleware,
  ) {
    super();

    const basePath = this.options.basePath ?? "/api/auth/";

    this.middlewareManager.globalExclude(basePath);

    this.middlewareManager
      .apply(this.authHandlerMiddleware)
      .disableGlobalExcludeRoutes()
      .forRoutes(basePath);

    if (this.options.middleware?.register !== false) {
      this.configureRequestMiddleware(
        this.middlewareManager
          .apply(this.authMiddleware)
          .dependencies(RequestContextMiddleware),
      );
    }
  }

  private configureRequestMiddleware(proxy: MiddlewareConfigurator): void {
    if (this.options.middleware?.excludeRoutes) {
      proxy.exclude(...this.options.middleware.excludeRoutes);
    }

    proxy.forRoutes(...(this.options.middleware?.includeRoutes ?? ["*"]));
  }
}
