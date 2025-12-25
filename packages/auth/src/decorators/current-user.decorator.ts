import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { BaseUser } from "../entities/user.entity";

export const CurrentUser = createParamDecorator(() =>
  RequestContext.get(BaseUser),
);
