import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { BaseSession } from "../entities/session.entity";

export const CurrentSession = createParamDecorator(() =>
  RequestContext.get(BaseSession),
);
