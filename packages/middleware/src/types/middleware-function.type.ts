/**
 * Middleware function type.
 */
export type MiddlewareFunction<TRequest = any, TResponse = any> = (
  req: TRequest,
  res: TResponse,
  next: (error?: any) => void,
) => any;
