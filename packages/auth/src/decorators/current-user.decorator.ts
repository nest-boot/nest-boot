import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { BaseUser } from "../entities/user.entity";

/**
 * Parameter decorator to get the current user from the request context.
 */
export const CurrentUser = createParamDecorator(() =>
  RequestContext.get(BaseUser),
);
