import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { AuthPayload } from "../interfaces";

export const CurrentPersonalAccessToken = createParamDecorator(() => {
  return RequestContext.get<AuthPayload>("auth")?.personalAccessToken;
});
