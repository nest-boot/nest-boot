import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { CURRENT_WORKSPACE_MEMBER } from "../auth.constants.js";
import type { AuthWorkspaceMemberEntity } from "../interfaces/auth-entities.interface.js";

/** Parameter decorator that injects the workspace member for the current request. */
export const CurrentWorkspaceMember = createParamDecorator(() =>
  RequestContext.get<AuthWorkspaceMemberEntity>(CURRENT_WORKSPACE_MEMBER),
);
