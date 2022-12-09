import { SetMetadata } from "@nestjs/common";

import { REQUIRE_AUTH_METADATA_KEY } from "../auth.module-definition";

export const RequireAuth = (
  requireAuth = true
): ClassDecorator & MethodDecorator =>
  SetMetadata(REQUIRE_AUTH_METADATA_KEY, requireAuth);
