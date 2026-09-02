import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import {
  Inject,
  Injectable,
  type NestMiddleware,
  type Type,
} from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

import { CURRENT_WORKSPACE } from "./auth.constants.js";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import type { AuthWorkspaceEntity } from "./interfaces/auth-entities.interface.js";

/** Resolves the workspace selected by a request header or browser cookie. */
@Injectable()
export class WorkspaceMiddleware implements NestMiddleware {
  /** Creates the workspace middleware. */
  constructor(
    private readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly authOptions: AuthModuleOptions,
  ) {}

  /** Loads the selected workspace into the request context. */
  async use(req: Request, _res: Response, next: NextFunction) {
    try {
      const headerWorkspaceId = req.headers["x-workspace-id"];
      const cookieWorkspaceId = (req.cookies as Record<string, unknown> | null)
        ?.workspace_id;
      const workspaceId = (
        (Array.isArray(headerWorkspaceId)
          ? headerWorkspaceId[0]
          : headerWorkspaceId) ??
        (typeof cookieWorkspaceId === "string" ? cookieWorkspaceId : undefined)
      )?.trim();

      if (workspaceId) {
        const workspace = await this.em.findOne(
          this.authOptions.entities.workspace,
          {
            deletedAt: null,
            id: workspaceId,
          },
        );

        if (workspace) {
          this.setCurrentWorkspace(workspace);
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  }

  private setCurrentWorkspace(workspace: AuthWorkspaceEntity): void {
    RequestContext.set(CURRENT_WORKSPACE, workspace);
    RequestContext.set(
      this.authOptions.entities.workspace as Type<AuthWorkspaceEntity>,
      workspace,
    );
  }
}
