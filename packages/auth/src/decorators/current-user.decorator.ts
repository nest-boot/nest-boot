import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { User } from "../entities/user.entity";

export const CurrentUser = createParamDecorator(() => {
  return RequestContext.get(User);
});
