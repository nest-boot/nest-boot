import { Context } from "@nest-boot/common";
import { createParamDecorator } from "@nestjs/common";

import { AuthPayload } from "../interfaces";

export const CurrentEntity = createParamDecorator(() => {
  return Context.get<AuthPayload>("auth")?.entity;
});

export const CurrentUser = CurrentEntity;
