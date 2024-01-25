import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { PersonalAccessToken } from "../entities/personal-access-token.entity";

export const CurrentPersonalAccessToken = createParamDecorator(() => {
  return RequestContext.get(PersonalAccessToken);
});
