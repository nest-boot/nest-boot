import { EntityManager } from "@mikro-orm/core";
import { cookies, RequestContext } from "@nest-boot/request-context";
import {
  BadRequestException,
  Inject,
  Injectable,
  type NestMiddleware,
  UnauthorizedException,
} from "@nestjs/common";
import { type NextFunction, type Request, type Response } from "express";

import { ApiKeyAuthenticationService } from "../api-key/services/api-key-authentication.service.js";
import { extractApiKey } from "../api-key/utils/extract-api-key.util.js";
import { runAuthQuery } from "../common/utils/run-auth-query.js";
import { Workspace } from "../workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../workspace/entities/workspace-member.entity.js";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import { AuthContext } from "./auth-context.js";
import { Session } from "./entities/session.entity.js";
import { User } from "./entities/user.entity.js";
import type { AuthContextPatch } from "./interfaces/auth-context-patch.interface.js";
import type { AuthModuleOptions } from "./interfaces/auth-module-options.interface.js";
import { SessionService } from "./services/session.service.js";

/** Builds the complete authentication context for an incoming request. */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  /** Requires identity-changing writes to commit before restaging request authorization. */
  assertAuthenticationCanChange(): void {
    if (this.em.isInTransaction()) {
      throw new BadRequestException(
        "Change request authentication outside an active transaction",
      );
    }
  }

  /** Clears the current credential after a successful sign-out. */
  clearAuthentication(): void {
    this.authContext.clear();
  }

  /**
   * Clears a session revoked by an authentication write, without falling back to another credential.
   * @returns Result of the authorized operation.
   */
  async revalidateCurrentSession(): Promise<void> {
    const current = RequestContext.isActive()
      ? RequestContext.get(Session)
      : null;
    if (!current) {
      return;
    }
    try {
      const session = await this.em.findOne(
        Session,
        {
          id: current.id,
          token: current.token,
          expiresAt: { $gt: new Date() },
        },
        { refresh: true },
      );
      if (!session) {
        this.authContext.clear();
      }
    } catch (error) {
      this.authContext.clear();
      throw error;
    }
  }

  /**
   * Reloads a profile written by Better Auth without changing its authentication method.
   * @returns Result of the authorized operation.
   */
  async refreshCurrentUser(): Promise<void> {
    const current = RequestContext.isActive() ? RequestContext.get(User) : null;
    if (!current) {
      return;
    }
    try {
      const user = await this.em.findOne(
        User,
        { id: current.id },
        { refresh: true },
      );
      if (!user) {
        throw new UnauthorizedException(
          "The current user is no longer available",
        );
      }
      this.authContext.set({ user });
    } catch (error) {
      this.authContext.clear();
      throw error;
    }
  }

  /**
   * Adopts a newly issued session, rebuilding workspace membership and RLS scope.
   * @param token - Token used to identify the requested value.
   * @returns Persisted user associated with the authenticated session.
   */
  async authenticateSession(token: string): Promise<User> {
    const data = await runAuthQuery(this.em, async (em) => {
      const session = await em.findOne(Session, {
        token,
        expiresAt: { $gt: new Date() },
      });
      const user = session
        ? await em.findOne(User, { id: session.user.id })
        : null;
      return { session, user };
    });
    if (
      !data.session ||
      !data.user ||
      (data.user.banned &&
        (!data.user.banExpiresAt || data.user.banExpiresAt > new Date()))
    ) {
      throw new UnauthorizedException("The new session is not valid");
    }
    try {
      const workspace = this.authContext.selectedWorkspace;
      const member = await this.findWorkspaceMember(data.user, workspace);
      this.authContext.initialize({
        apiKey: null,
        user: data.user,
        session: data.session,
        workspace,
        member,
      });
    } catch (error) {
      this.authContext.clear();
      throw error;
    }
    return data.user;
  }
  /**
   * Hydrates only the user returned by a successful registration without issuing an identity.
   * @param id - Identifier of the record to access.
   * @returns Persisted user associated with the session result.
   * @internal
   */
  async resolveRegisteredUser(id: string): Promise<User> {
    return await runAuthQuery(this.em, (em) => em.findOneOrFail(User, { id }));
  }

  /**
   * Creates the authentication-context middleware.
   * @param options - Authentication module configuration.
   * @param sessionService - Service for session queries and revocation.
   * @param apiKeyService - Service for validating or managing API keys.
   * @param em - Entity manager used for persistence.
   * @param authContext - Current request authentication context.
   */
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
    private readonly sessionService: SessionService,
    private readonly apiKeyService: ApiKeyAuthenticationService,
    private readonly em: EntityManager,
    private readonly authContext: AuthContext,
  ) {}

  /**
   * Resolves workspace, credentials, and membership in their required order.
   * @param req - Incoming HTTP request.
   * @param _res - Outgoing HTTP response.
   * @param next - Next handler in the Nest execution chain.
   */
  async use(req: Request, _res: Response, next: NextFunction) {
    try {
      this.authContext.initialize(await this.resolveIdentity(req));
      next();
    } catch (error) {
      try {
        this.authContext.clear();
      } catch {
        /* Preserve the original authentication failure. */
      }
      next(error);
    }
  }

  private async resolveIdentity(req: Request): Promise<AuthContextPatch> {
    const workspace = await this.findSelectedWorkspace(req);
    const session = await this.sessionService.getCurrentAuthenticatedSession();
    if (session) {
      return {
        apiKey: null,
        user: session.user,
        session: session.session,
        workspace,
        member: await this.findWorkspaceMember(session.user, workspace),
      };
    }
    const plaintext = extractApiKey(req);
    if (!plaintext) {
      return {
        apiKey: null,
        user: null,
        session: null,
        member: null,
        workspace,
      };
    }
    if (!this.apiKeyService) {
      throw new UnauthorizedException("API keys are disabled");
    }
    const validation = await this.apiKeyService.validate(plaintext);
    if (validation.ownerType === "system_account") {
      return {
        apiKey: validation.apiKey,
        user: null,
        session: null,
        member: null,
        workspace,
      };
    }
    return {
      apiKey: validation.apiKey,
      user: validation.user,
      session: null,
      workspace,
      member:
        validation.ownerType === "user"
          ? await this.findWorkspaceMember(validation.user, workspace)
          : workspace?.id === validation.workspace.id
            ? validation.member
            : null,
    };
  }

  private async findSelectedWorkspace(req: Request): Promise<Workspace | null> {
    if (this.options.workspace?.enabled !== true) {
      return null;
    }
    const header = req.headers["x-workspace-id"];
    const id = (
      (Array.isArray(header) ? header[0] : header) ??
      cookies().get("workspace_id")?.value
    )?.trim();
    if (!id) {
      return null;
    }
    if (!/^\d+$/.test(id) || BigInt(id) > 9223372036854775807n) {
      throw new BadRequestException("Invalid workspace ID");
    }
    return await this.em.findOne(Workspace, { id });
  }

  private async findWorkspaceMember(
    user: User,
    workspace: Workspace | null,
  ): Promise<WorkspaceMember | null> {
    if (this.options.workspace?.enabled !== true || !workspace) {
      return null;
    }
    return await runAuthQuery(this.em, (em) =>
      em.findOne(WorkspaceMember, { status: "ACTIVE", user, workspace }),
    );
  }
}
