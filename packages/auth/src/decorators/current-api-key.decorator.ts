import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { CURRENT_API_KEY } from "../auth.constants.js";
import type { BaseApiKey } from "../entities/index.js";

/** Parameter decorator that injects the API key used for the current request. */
export const CurrentApiKey = createParamDecorator(() =>
  RequestContext.get<BaseApiKey>(CURRENT_API_KEY),
);
