import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { BaseApiKey } from "../entities/index.js";

/** Parameter decorator that injects the API key used for the current request. */
export const CurrentApiKey = createParamDecorator(() =>
  RequestContext.get(BaseApiKey),
);
