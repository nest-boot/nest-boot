import { CustomDecorator, SetMetadata } from "@nestjs/common";

import { PERMISSIONS_METADATA_KEY } from "../constants";

export const Can = (...permissions: string[]): CustomDecorator =>
  SetMetadata(PERMISSIONS_METADATA_KEY, permissions);
