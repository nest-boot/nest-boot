import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { AUTH_ENTITY } from "../auth.constants";

export const CurrentEntity = createParamDecorator(() => {
  return RequestContext.get(AUTH_ENTITY);
});

export const CurrentUser = CurrentEntity;
