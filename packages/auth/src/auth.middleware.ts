import { EntityManager } from "@mikro-orm/core";
import {
  RequestContext,
  type RequestContextToken,
} from "@nest-boot/request-context";
import {
  Inject,
  Injectable,
  type NestMiddleware,
  UnauthorizedException,
} from "@nestjs/common";
import { type NextFunction, type Request, type Response } from "express";

import { ApiKeyService } from "./api-key.service.js";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import {
  BaseAccount,
  BaseApiKey,
  BaseSession,
  BaseUser,
  BaseVerification,
  BaseWorkspace,
  BaseWorkspaceInvitation,
  BaseWorkspaceMember,
} from "./entities/index.js";
import { SessionService } from "./session.service.js";
import { extractApiKey } from "./utils/extract-api-key.util.js";

/** Builds the complete authentication context for an incoming request. */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  /** Creates the authentication-context middleware. */
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
    private readonly sessionService: SessionService,
    private readonly apiKeyService: ApiKeyService,
    private readonly em: EntityManager,
  ) {}

  /** Resolves workspace, credentials, and membership in their required order. */
  async use(req: Request, _res: Response, next: NextFunction) {
    try {
      this.registerEntityAliases();
      await this.resolveSelectedWorkspace(req);
      const hasSession = await this.resolveSession();
      if (!hasSession) await this.resolveApiKey(req);
      await this.resolveWorkspaceMember();
      next();
    } catch (error) {
      next(error);
    }
  }

  private async resolveSelectedWorkspace(req: Request): Promise<void> {
    const headerWorkspaceId = req.headers["x-workspace-id"];
    const cookieWorkspaceId = (req.cookies as Record<string, unknown> | null)
      ?.workspace_id;
    const workspaceId = (
      (Array.isArray(headerWorkspaceId)
        ? headerWorkspaceId[0]
        : headerWorkspaceId) ??
      (typeof cookieWorkspaceId === "string" ? cookieWorkspaceId : undefined)
    )?.trim();
    if (!workspaceId) return;

    const workspace = await this.em.findOne(this.options.entities.workspace, {
      deletedAt: null,
      id: workspaceId,
    });
    if (workspace) this.setWorkspace(workspace);
  }

  private async resolveSession(): Promise<boolean> {
    const data = await this.sessionService.getSession();
    if (!data) return false;

    this.setUser(data.user);
    RequestContext.set(BaseSession, data.session);
    await this.options.onAuthenticated?.();
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

    const selectedWorkspace = RequestContext.get(BaseWorkspace);
    if (selectedWorkspace && selectedWorkspace.id !== validation.workspace.id) {
      throw new UnauthorizedException(
        "Workspace API key does not belong to the selected workspace",
      );
    }
    this.setWorkspace(validation.workspace);
  }

  private async resolveWorkspaceMember(): Promise<void> {
    const user = RequestContext.get(BaseUser);
    const workspace = RequestContext.get(BaseWorkspace);
    if (!user || !workspace) return;

    const member = await this.em.findOne(
      this.options.entities.workspaceMember,
      {
        status: "ACTIVE",
        user,
        workspace,
      },
    );
    if (!member) return;

    RequestContext.set(BaseWorkspaceMember, member);
  }

  private setApiKey(apiKey: BaseApiKey): void {
    RequestContext.set(BaseApiKey, apiKey);
  }

  private setUser(user: BaseUser): void {
    RequestContext.set(BaseUser, user);
  }

  private setWorkspace(workspace: BaseWorkspace): void {
    RequestContext.set(BaseWorkspace, workspace);
  }

  private registerEntityAliases(): void {
    this.registerEntityAlias(this.options.entities.account, BaseAccount);
    this.registerEntityAlias(this.options.entities.user, BaseUser);
    this.registerEntityAlias(this.options.entities.session, BaseSession);
    this.registerEntityAlias(this.options.entities.apiKey, BaseApiKey);
    this.registerEntityAlias(
      this.options.entities.verification,
      BaseVerification,
    );
    this.registerEntityAlias(this.options.entities.workspace, BaseWorkspace);
    this.registerEntityAlias(
      this.options.entities.workspaceInvitation,
      BaseWorkspaceInvitation,
    );
    this.registerEntityAlias(
      this.options.entities.workspaceMember,
      BaseWorkspaceMember,
    );
  }

  private registerEntityAlias(
    entity: RequestContextToken,
    baseEntity: RequestContextToken,
  ): void {
    if (entity !== baseEntity) RequestContext.alias(entity, baseEntity);
  }
}
