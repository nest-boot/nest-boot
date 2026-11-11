import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { Workspace } from "../entities/workspace.entity.js";

/** Parameter decorator that injects the workspace selected for the current request. */
export const CurrentWorkspace = createParamDecorator(() =>
  RequestContext.get(Workspace),
);
