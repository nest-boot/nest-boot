import {
  BeforeCreate,
  BeforeUpdate,
  EventArgs,
  Property,
  PropertyOptions,
} from "@mikro-orm/core";
import { HashService } from "@nest-boot/hash";

const HASH_PROPERTIES_KEY = Symbol("hashProperties");

/**
 * Decorator that marks a property as a hashed field.
 * The property value will be automatically hashed before create and update operations.
 *
 * @example
 * ```typescript
 * import { Entity } from '@mikro-orm/core';
 * import { HashProperty } from '@nest-boot/mikro-orm-hash';
 *
 * @Entity()
 * export class User {
 *   @HashProperty({ type: t.string })
 *   password!: string;
 * }
 * ```
 */
export function HashProperty<T extends object>(
  options?: Partial<PropertyOptions<T>>,
): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    if (typeof propertyKey !== "string") {
      throw new Error(
        "HashProperty decorator can only be used on string properties.",
      );
    }

    Property({ ...options, hidden: true, lazy: true })(target, propertyKey);

    // Collect all properties that need to be hashed (create a copy to avoid sharing array during inheritance)
    const existingProperties: string[] = [
      ...(Reflect.getMetadata(HASH_PROPERTIES_KEY, target) ?? []),
    ];

    if (!existingProperties.includes(propertyKey)) {
      existingProperties.push(propertyKey);
      Reflect.defineMetadata(HASH_PROPERTIES_KEY, existingProperties, target);
    }

    // Only define hashProperties method on first decoration
    if (!Object.prototype.hasOwnProperty.call(target, "__hashProperties__")) {
      const hashProperties = async function <E extends object>(
        this: E,
        args: EventArgs<E>,
      ) {
        const properties: string[] =
          Reflect.getMetadata(
            HASH_PROPERTIES_KEY,
            Object.getPrototypeOf(this),
          ) ?? [];

        const payload = args.changeSet?.payload as Record<string, unknown>;

        for (const key of properties) {
          const value = payload?.[key];

          if (typeof value === "string") {
            (this as Record<string, unknown>)[key] =
              await HashService.hash(value);
          }
        }
      };

      Object.defineProperty(target, "__hashProperties__", {
        value: hashProperties,
        writable: true,
        configurable: true,
      });

      BeforeCreate()(target, "__hashProperties__");
      BeforeUpdate()(target, "__hashProperties__");
    }
  };
}
