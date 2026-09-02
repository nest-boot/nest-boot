import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import {
  Inject,
  Injectable,
  type NestMiddleware,
  type Type,
} from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

import {
  CURRENT_WORKSPACE,
  CURRENT_WORKSPACE_MEMBER,
} from "./auth.constants.js";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import { BaseUser } from "./entities/user.entity.js";
import type {
  AuthWorkspaceEntity,
  AuthWorkspaceMemberEntity,
} from "./interfaces/auth-entities.interface.js";

/** Resolves the authenticated user's membership in the selected workspace. */
@Injectable()
export class WorkspaceMemberMiddleware implements NestMiddleware {
  /** Creates the workspace-member middleware. */
  constructor(
    private readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly authOptions: AuthModuleOptions,
  ) {}

  /** Loads a session user's workspace membership into the request context. */
  async use(_req: Request, _res: Response, next: NextFunction) {
    try {
      if (RequestContext.get(CURRENT_WORKSPACE_MEMBER)) {
        next();
        return;
      }

      const user = RequestContext.get(BaseUser);
      const workspace =
        RequestContext.get<AuthWorkspaceEntity>(CURRENT_WORKSPACE);

      if (user && workspace) {
        const workspaceMember = await this.em.findOne(
          this.authOptions.entities.workspaceMember,
          { user, workspace },
        );

        if (workspaceMember) {
          this.setCurrentWorkspaceMember(workspaceMember);
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  }

  private setCurrentWorkspaceMember(
    workspaceMember: AuthWorkspaceMemberEntity,
  ): void {
    RequestContext.set(CURRENT_WORKSPACE_MEMBER, workspaceMember);
    RequestContext.set(
      this.authOptions.entities
        .workspaceMember as Type<AuthWorkspaceMemberEntity>,
      workspaceMember,
    );
  }
}
