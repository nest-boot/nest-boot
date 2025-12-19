/**
 * Token for storing the HTTP request object in the request context.
 *
 * @example
 * ```typescript
 * import { REQUEST } from '@nest-boot/request-context';
 * import { Request } from 'express';
 *
 * const req = RequestContext.get<Request>(REQUEST);
 * ```
 */
export const REQUEST = "REQUEST";

/**
 * Token for storing the HTTP response object in the request context.
 *
 * @example
 * ```typescript
 * import { RESPONSE } from '@nest-boot/request-context';
 * import { Response } from 'express';
 *
 * const res = RequestContext.get<Response>(RESPONSE);
 * ```
 */
export const RESPONSE = "RESPONSE";
