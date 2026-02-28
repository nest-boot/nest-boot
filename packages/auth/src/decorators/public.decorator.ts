import { SetMetadata } from "@nestjs/common";

import { IS_PUBLIC_KEY } from "../auth.constants";

/** Decorator that marks a route as public, bypassing the {@link AuthGuard}. */
export const Public = (value = true) => SetMetadata(IS_PUBLIC_KEY, value);
