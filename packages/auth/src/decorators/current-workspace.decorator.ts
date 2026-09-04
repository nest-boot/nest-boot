import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { BaseWorkspace } from "../entities/index.js";

/** Parameter decorator that injects the workspace selected for the current request. */
export const CurrentWorkspace = createParamDecorator(() =>
  RequestContext.get(BaseWorkspace),
);
