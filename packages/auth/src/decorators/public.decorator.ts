import { SetMetadata } from "@nestjs/common";

import { IS_PUBLIC_KEY } from "../auth.constants.js";

/**
 * Decorator that marks a route as public, bypassing the {@link AuthGuard}.
 * @param value - Whether the route permits unauthenticated access.
 * @returns Decorator that sets the route public-access flag.
 */
export const Public = (value = true) => SetMetadata(IS_PUBLIC_KEY, value);
