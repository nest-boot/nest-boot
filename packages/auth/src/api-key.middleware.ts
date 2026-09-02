import { RequestContext } from "@nest-boot/request-context";
import {
  Inject,
  Injectable,
  type NestMiddleware,
  type Type,
} from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

import { ApiKeyService } from "./api-key.service.js";
import {
  CURRENT_API_KEY,
  CURRENT_WORKSPACE,
  CURRENT_WORKSPACE_MEMBER,
} from "./auth.constants.js";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import { BaseSession } from "./entities/session.entity.js";
import type {
  AuthApiKeyEntity,
  AuthWorkspaceEntity,
  AuthWorkspaceMemberEntity,
} from "./interfaces/auth-entities.interface.js";
import { extractApiKey } from "./utils/extract-api-key.util.js";

/** Authenticates API keys and restores their workspace identity. */
@Injectable()
export class ApiKeyMiddleware implements NestMiddleware {
  /** Creates the API-key middleware. */
  constructor(
    private readonly apiKeyService: ApiKeyService,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly authOptions: AuthModuleOptions,
  ) {}

  /** Validates a request API key and stores its identity in the request context. */
  async use(req: Request, _res: Response, next: NextFunction) {
    try {
      const plaintextApiKey = RequestContext.get(BaseSession)
        ? null
        : extractApiKey(req);

      if (plaintextApiKey) {
        const { apiKey, workspace, workspaceMember } =
          await this.apiKeyService.validate(plaintextApiKey);

        this.setContext(apiKey, workspace, workspaceMember);
      }

      next();
    } catch (error) {
      next(error);
    }
  }

  private setContext(
    apiKey: AuthApiKeyEntity,
    workspace: AuthWorkspaceEntity,
    workspaceMember: AuthWorkspaceMemberEntity,
  ): void {
    RequestContext.set(CURRENT_API_KEY, apiKey);
    RequestContext.set(CURRENT_WORKSPACE, workspace);
    RequestContext.set(CURRENT_WORKSPACE_MEMBER, workspaceMember);
    RequestContext.set(
      this.authOptions.entities.apiKey as Type<AuthApiKeyEntity>,
      apiKey,
    );
    RequestContext.set(
      this.authOptions.entities.workspace as Type<AuthWorkspaceEntity>,
      workspace,
    );
    RequestContext.set(
      this.authOptions.entities
        .workspaceMember as Type<AuthWorkspaceMemberEntity>,
      workspaceMember,
    );
  }
}
