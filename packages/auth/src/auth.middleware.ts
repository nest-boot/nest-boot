import { EntityManager } from "@mikro-orm/core";
import { cookies, RequestContext } from "@nest-boot/request-context";
import {
  Inject,
  Injectable,
  type NestMiddleware,
  UnauthorizedException,
} from "@nestjs/common";
import { type NextFunction, type Request, type Response } from "express";

import { UserAbility } from "./abilities/user.ability.js";
import { WorkspaceAbility } from "./abilities/workspace.ability.js";
import { API_KEY } from "./auth.constants.js";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import { Member } from "./entities/member.entity.js";
import { Session } from "./entities/session.entity.js";
import { User } from "./entities/user.entity.js";
import { Workspace } from "./entities/workspace.entity.js";
import { ApiKeyAuthenticationService } from "./infrastructure/api-key-authentication.service.js";
import { SessionService } from "./services/session.service.js";
import type { ApiKey } from "./types/api-key.type.js";
import { extractApiKey } from "./utils/extract-api-key.util.js";
import { getCurrentApiKey } from "./utils/get-current-api-key.util.js";
import { resolveRequestPermissions } from "./utils/resolve-request-permissions.util.js";
import { runAuthQuery } from "./utils/run-auth-query.js";

/** Builds the complete authentication context for an incoming request. */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  /** Adopts a newly issued session, rebuilding workspace membership and RLS scope. */
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
    RequestContext.set<ApiKey | null>(API_KEY, null);
    RequestContext.set(Member, null);
    RequestContext.set(UserAbility, null);
    RequestContext.set(WorkspaceAbility, null);
    this.setUser(data.user);
    RequestContext.set(Session, data.session);
    await this.resolveMember();
    this.updateSessionContext();
    return data.user;
  }
  /** Hydrates only the user returned by a successful registration without issuing an identity. @internal */
  async resolveRegisteredUser(id: string): Promise<User> {
    return await runAuthQuery(this.em, (em) => em.findOneOrFail(User, { id }));
  }

  /** Creates the authentication-context middleware. */
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
    private readonly sessionService: SessionService,
    private readonly apiKeyService: ApiKeyAuthenticationService,
    private readonly em: EntityManager,
  ) {}

  /** Resolves workspace, credentials, and membership in their required order. */
  async use(req: Request, _res: Response, next: NextFunction) {
    try {
      await this.resolveSelectedWorkspace(req);
      const hasSession = await this.resolveSession();
      if (!hasSession) await this.resolveApiKey(req);
      await this.resolveMember();
      this.updateSessionContext();
      next();
    } catch (error) {
      next(error);
    }
  }

  private async resolveSelectedWorkspace(req: Request): Promise<void> {
    const headerWorkspaceId = req.headers["x-workspace-id"];
    const cookieWorkspaceId = cookies().get("workspace_id")?.value;
    const workspaceId = (
      (Array.isArray(headerWorkspaceId)
        ? headerWorkspaceId[0]
        : headerWorkspaceId) ?? cookieWorkspaceId
    )?.trim();
    if (!workspaceId) return;

    const workspace = await this.em.findOne(Workspace, {
      deletedAt: null,
      id: workspaceId,
    });
    if (workspace) this.setWorkspace(workspace);
  }

  private async resolveSession(): Promise<boolean> {
    const data = await this.sessionService.getCurrentAuthenticatedSession();
    if (!data) return false;

    this.setUser(data.user);
    RequestContext.set(Session, data.session);
    return true;
  }

  private async resolveApiKey(req: Request): Promise<void> {
    const plaintextApiKey = extractApiKey(req);
    if (!plaintextApiKey) return;

    const validation = await this.apiKeyService.validate(plaintextApiKey);
    this.setApiKey(validation.apiKey);
    if (validation.ownerType === "user") {
      this.setUser(validation.user);
      return;
    }

    const selectedWorkspace = RequestContext.get(Workspace);
    if (selectedWorkspace && selectedWorkspace.id !== validation.workspace.id) {
      throw new UnauthorizedException(
        "Workspace API key does not belong to the selected workspace",
      );
    }
    this.setWorkspace(validation.workspace);
  }

  private async resolveMember(): Promise<void> {
    const user = RequestContext.get(User);
    const workspace = RequestContext.get(Workspace);
    if (!user || !workspace) return;

    const member = await runAuthQuery(
      this.em,
      async (em) =>
        await em.findOne(Member, {
          status: "ACTIVE",
          user,
          workspace,
        }),
    );
    if (!member) return;

    RequestContext.set(Member, member);
  }

  private setApiKey(apiKey: ApiKey): void {
    RequestContext.set<ApiKey | null>(API_KEY, apiKey);
  }

  private updateSessionContext(): void {
    const user = RequestContext.get(User);
    const apiKey = getCurrentApiKey();
    const workspace = RequestContext.get(Workspace);
    const member = RequestContext.get(Member);
    const authenticated = Boolean(user ?? apiKey);
    const canUseWorkspace = Boolean(member ?? (apiKey && !user));
    const permissions = resolveRequestPermissions(this.options);

    this.em.setSessionContext({
      role: authenticated ? "authenticated" : "anonymous",
      variables: {
        "app.user.id": user?.id ?? "",
        "app.user.permissions": JSON.stringify(permissions.user),
        "app.workspace.id":
          !authenticated || canUseWorkspace ? (workspace?.id ?? "") : "",
        "app.workspace.permissions": JSON.stringify(permissions.workspace),
      },
    });
  }

  private setUser(user: User): void {
    RequestContext.set(User, user);
  }

  private setWorkspace(workspace: Workspace): void {
    RequestContext.set(Workspace, workspace);
  }
}
