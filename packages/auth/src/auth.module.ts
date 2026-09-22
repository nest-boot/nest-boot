import { MikroORM } from "@mikro-orm/core";
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

import { ApiKeyUsageInterceptor } from "./api-key-usage.interceptor.js";
import { AUTH_TOKEN } from "./auth.constants.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthMiddleware } from "./auth.middleware.js";
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./auth.module-definition.js";
import { AuthHandlerMiddleware } from "./auth-handler.middleware.js";
import { type AuthModuleOptions } from "./auth-module-options.interface.js";
import { AuthEnumRegistry } from "./infrastructure/auth-enum-registry.js";
import { authServiceProviders } from "./infrastructure/auth-service.providers.js";
import { createAuthInstance } from "./infrastructure/create-auth-instance.js";
import { AuthResolver } from "./resolvers/auth.resolver.js";
import { InvitationResolver } from "./resolvers/invitation.resolver.js";
import { MemberResolver } from "./resolvers/member.resolver.js";
import { SessionResolver } from "./resolvers/session.resolver.js";
import { UserResolver } from "./resolvers/user.resolver.js";
import { UserApiKeyResolver } from "./resolvers/user-api-key.resolver.js";
import { WorkspaceResolver } from "./resolvers/workspace.resolver.js";
import { WorkspaceApiKeyResolver } from "./resolvers/workspace-api-key.resolver.js";
import { AccountService } from "./services/account.service.js";
import { AuthService } from "./services/auth.service.js";
import { InvitationService } from "./services/invitation.service.js";
import { MemberService } from "./services/member.service.js";
import { SessionService } from "./services/session.service.js";
import { UserService } from "./services/user.service.js";
import { UserApiKeyService } from "./services/user-api-key.service.js";
import { UserDeletionService } from "./services/user-deletion.service.js";
import { WorkspaceService } from "./services/workspace.service.js";
import { WorkspaceApiKeyService } from "./services/workspace-api-key.service.js";
import {
  DEFAULT_USER_PERMISSIONS,
  DEFAULT_USER_ROLES,
} from "./user.constants.js";
import {
  DEFAULT_WORKSPACE_PERMISSIONS,
  DEFAULT_WORKSPACE_ROLES,
} from "./workspace.constants.js";

/**
 * Authentication module based on better-auth.
 *
 * @remarks
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
    UserApiKeyResolver,
    WorkspaceApiKeyResolver,
    WorkspaceResolver,
    MemberResolver,
    InvitationResolver,
    ...authServiceProviders,
    UserApiKeyService,
    WorkspaceApiKeyService,
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
    MODULE_OPTIONS_TOKEN,
    UserService,
    UserApiKeyService,
    WorkspaceApiKeyService,
    AuthGuard,
    AuthService,
    SessionService,
    WorkspaceService,
    MemberService,
    InvitationService,
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
    return super.forRoot(options as unknown as AuthModuleOptions);
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
    return super.forRootAsync(
      options as unknown as ConfigurableModuleAsyncOptions<AuthModuleOptions>,
    );
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
