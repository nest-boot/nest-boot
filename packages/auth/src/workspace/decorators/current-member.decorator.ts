import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { Member } from "../entities/member.entity.js";

/** Parameter decorator that injects the workspace member for the current request. */
export const CurrentMember = createParamDecorator(() =>
  RequestContext.get(Member),
);
