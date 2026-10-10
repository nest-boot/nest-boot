import "reflect-metadata";

import type { CustomDecorator } from "@nestjs/common";

/**
 * Appends one value to array metadata on a class or method.
 * @param metadataKey - Key under which the metadata is stored.
 * @param metadataValue - Metadata entries to append.
 * @returns Decorator that appends values under the metadata key.
 */
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
