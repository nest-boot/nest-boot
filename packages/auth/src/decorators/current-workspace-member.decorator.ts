import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { BaseWorkspaceMember } from "../entities/index.js";

/** Parameter decorator that injects the workspace member for the current request. */
export const CurrentWorkspaceMember = createParamDecorator(() =>
  RequestContext.get(BaseWorkspaceMember),
);
