import "reflect-metadata";

import type { CustomDecorator } from "@nestjs/common";

/** Appends one value to array metadata on a class or method. */
export function appendMetadata<TKey>(
  metadataKey: TKey,
  metadataValue: unknown,
): CustomDecorator<TKey> {
  const decorator = (
    target: object,
    _propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    const metadataTarget = descriptor?.value ?? target;
    const previousMetadata = Reflect.getMetadata(
      metadataKey,
      metadataTarget,
    ) as unknown[] | undefined;

    Reflect.defineMetadata(
      metadataKey,
      [...(previousMetadata ?? []), metadataValue],
      metadataTarget,
    );

    return descriptor ?? target;
  };

  decorator.KEY = metadataKey;
  return decorator as CustomDecorator<TKey>;
}
