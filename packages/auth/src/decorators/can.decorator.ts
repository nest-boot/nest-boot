import { SetMetadata } from "@nestjs/common";

import { PERMISSIONS_METADATA_KEY } from "../auth.constants";

export const Can = (...roles: string[]): ClassDecorator & MethodDecorator =>
  SetMetadata(PERMISSIONS_METADATA_KEY, roles);
