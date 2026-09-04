import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import {
  Inject,
  Injectable,
  type NestMiddleware,
  type Type,
  UnauthorizedException,
} from "@nestjs/common";
import { type NextFunction, type Request, type Response } from "express";

import { ApiKeyService } from "./api-key.service.js";
import {
  CURRENT_API_KEY,
  CURRENT_WORKSPACE,
  CURRENT_WORKSPACE_MEMBER,
} from "./auth.constants.js";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import type {
  BaseApiKey,
  BaseWorkspace,
  BaseWorkspaceMember,
} from "./entities/index.js";
import { BaseSession, BaseUser } from "./entities/index.js";
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
    RequestContext.set(
      this.options.entities.session as Type<BaseSession>,
      data.session,
    );
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

    const selectedWorkspace =
      RequestContext.get<BaseWorkspace>(CURRENT_WORKSPACE);
    if (selectedWorkspace && selectedWorkspace.id !== validation.workspace.id) {
      throw new UnauthorizedException(
        "Workspace API key does not belong to the selected workspace",
      );
    }
    this.setWorkspace(validation.workspace);
  }

  private async resolveWorkspaceMember(): Promise<void> {
    const user = RequestContext.get(BaseUser);
    const workspace = RequestContext.get<BaseWorkspace>(CURRENT_WORKSPACE);
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

    RequestContext.set(CURRENT_WORKSPACE_MEMBER, member);
    RequestContext.set(
      this.options.entities.workspaceMember as Type<BaseWorkspaceMember>,
      member,
    );
  }

  private setApiKey(apiKey: BaseApiKey): void {
    RequestContext.set(CURRENT_API_KEY, apiKey);
    RequestContext.set(
      this.options.entities.apiKey as Type<BaseApiKey>,
      apiKey,
    );
  }

  private setUser(user: BaseUser): void {
    RequestContext.set(BaseUser, user);
    RequestContext.set(this.options.entities.user as Type<BaseUser>, user);
  }

  private setWorkspace(workspace: BaseWorkspace): void {
    RequestContext.set(CURRENT_WORKSPACE, workspace);
    RequestContext.set(
      this.options.entities.workspace as Type<BaseWorkspace>,
      workspace,
    );
  }
}
