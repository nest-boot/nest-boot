import { type CustomDecorator, SetMetadata } from "@nestjs/common";

import { IS_PUBLIC_KEY } from "../constants/public.constants.js";

/**
 * Marks a controller or route handler as public so authentication guards can allow anonymous access.
 * @param value - Whether the target permits unauthenticated access.
 * @returns Metadata decorator setting {@link IS_PUBLIC_KEY}.
 */
export const Public = (value = true): CustomDecorator<typeof IS_PUBLIC_KEY> =>
  SetMetadata(IS_PUBLIC_KEY, value);
