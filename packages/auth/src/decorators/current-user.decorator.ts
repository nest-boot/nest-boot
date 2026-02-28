import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { BaseUser } from "../entities/user.entity";

/** Parameter decorator that injects the current {@link BaseUser} from the request context. */
export const CurrentUser = createParamDecorator(() =>
  RequestContext.get(BaseUser),
);
