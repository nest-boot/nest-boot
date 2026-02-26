import { SetMetadata } from "@nestjs/common";

import { RequestContextCreateOptions } from "./interfaces";
import { CREATE_REQUEST_CONTEXT_METADATA } from "./request-context.constants";

/**
 * Decorator to create a new RequestContext for a method execution.
 * Useful for ensuring a context exists in background tasks or subscribers.
 *
 * @param options - Options for creating the context.
 */
export const CreateRequestContext = (options?: RequestContextCreateOptions) => {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    SetMetadata<string, RequestContextCreateOptions>(
      CREATE_REQUEST_CONTEXT_METADATA,
      options ?? {},
    )(target, propertyKey, descriptor);
  };
};
