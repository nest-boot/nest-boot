import { SetMetadata } from "@nestjs/common";

import { IS_PUBLIC_KEY } from "../auth.constants";

/**
 * Decorator to mark a route or controller as public (authentication not required).
 */
export const Public = (value = true) => SetMetadata(IS_PUBLIC_KEY, value);
