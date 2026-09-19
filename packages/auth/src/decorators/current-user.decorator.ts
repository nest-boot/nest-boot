import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { User } from "../entities/user.entity.js";

/** Parameter decorator that injects the current {@link User} from the request context. */
export const CurrentUser = createParamDecorator(() => RequestContext.get(User));
