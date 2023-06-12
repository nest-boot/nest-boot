import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { AUTH_ACCESS_TOKEN } from "../auth.constants";
import { type AccessTokenInterface } from "../interfaces";

export const CurrentAccessToken = createParamDecorator(() => {
  return RequestContext.get<AccessTokenInterface>(AUTH_ACCESS_TOKEN);
});
