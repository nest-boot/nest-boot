import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { AUTH_PERSONAL_ACCESS_TOKEN } from "../auth.constants";

export const CurrentPersonalAccessToken = createParamDecorator(() => {
  return RequestContext.get(AUTH_PERSONAL_ACCESS_TOKEN);
});
