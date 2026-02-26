import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { BaseSession } from "../entities/session.entity";

/**
 * Parameter decorator to get the current session from the request context.
 */
export const CurrentSession = createParamDecorator(() =>
  RequestContext.get(BaseSession),
);
