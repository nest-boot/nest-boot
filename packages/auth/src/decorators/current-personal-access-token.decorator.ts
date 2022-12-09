import { Context } from "@nest-boot/common";
import { createParamDecorator } from "@nestjs/common";

import { AuthPayload } from "../interfaces";

export const CurrentPersonalAccessToken = createParamDecorator(() => {
  return Context.get<AuthPayload>("auth")?.personalAccessToken;
});
