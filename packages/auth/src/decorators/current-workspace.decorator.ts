import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { CURRENT_WORKSPACE } from "../auth.constants.js";
import type { BaseWorkspace } from "../entities/index.js";

/** Parameter decorator that injects the workspace selected for the current request. */
export const CurrentWorkspace = createParamDecorator(() =>
  RequestContext.get<BaseWorkspace>(CURRENT_WORKSPACE),
);
