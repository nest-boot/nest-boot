import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { AUTH_WORKSPACE } from "../../core/constants/auth.constants.js";

/** Injects the request's authenticated workspace scope, or null for selection alone. */
export const AuthWorkspace = createParamDecorator(
  () => RequestContext.get(AUTH_WORKSPACE) ?? null,
);
