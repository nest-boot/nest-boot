import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { AUTH_USER } from "../auth.constants";

export const CurrentUser = createParamDecorator(() => {
  return RequestContext.get(AUTH_USER);
});
