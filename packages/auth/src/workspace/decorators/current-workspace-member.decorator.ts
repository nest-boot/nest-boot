import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { WorkspaceMember } from "../entities/workspace-member.entity.js";

/** Parameter decorator that injects the workspace member for the current request. */
export const CurrentWorkspaceMember = createParamDecorator(() =>
  RequestContext.get(WorkspaceMember),
);
