import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { AuthPayload } from "../interfaces";

export const CurrentEntity = createParamDecorator(() => {
  return RequestContext.get<AuthPayload>("auth")?.entity;
});

export const CurrentUser = CurrentEntity;
