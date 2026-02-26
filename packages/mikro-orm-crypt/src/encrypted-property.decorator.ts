import {
  BeforeCreate,
  BeforeUpdate,
  EventArgs,
  Property,
  PropertyOptions,
} from "@mikro-orm/core";
import { CryptService, isJwe } from "@nest-boot/crypt";

const ENCRYPTED_PROPERTIES_KEY = Symbol("encryptedProperties");

/**
 * Decorator that marks a property as an encrypted field.
 * The property value will be automatically encrypted before create and update operations.
 *
 * It uses the CryptService to encrypt the value. If the value is already a JWE, it is skipped.
 *
 * @param options - MikroORM property options.
 *
 * @example
 * ```typescript
 * import { Entity, t } from '@mikro-orm/core';
 * import { EncryptedProperty } from '@nest-boot/mikro-orm-crypt';
 *
 * @Entity()
 * export class User {
 *   @EncryptedProperty({ type: t.text })
 *   ssn!: string;
 * }
 * ```
 */
export function EncryptedProperty<T extends object>(
  options?: Partial<PropertyOptions<T>>,
): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    if (typeof propertyKey !== "string") {
      throw new Error(
        "EncryptedProperty decorator can only be used on string properties.",
      );
    }

    Property({ hidden: true, lazy: true, ...options })(target, propertyKey);

    // Collect all properties that need to be encrypted (create a copy to avoid sharing array during inheritance)
    const existingProperties: string[] = [
      ...(Reflect.getMetadata(ENCRYPTED_PROPERTIES_KEY, target) ?? []),
    ];

    if (!existingProperties.includes(propertyKey)) {
      existingProperties.push(propertyKey);
      Reflect.defineMetadata(
        ENCRYPTED_PROPERTIES_KEY,
        existingProperties,
        target,
      );
    }

    // Only define encryptProperties method on first decoration
    if (
      !Object.prototype.hasOwnProperty.call(target, "__encryptProperties__")
    ) {
      const encryptProperties = async function <E extends object>(
        this: E,
        args: EventArgs<E>,
      ) {
        const properties: string[] =
          Reflect.getMetadata(
            ENCRYPTED_PROPERTIES_KEY,
            Object.getPrototypeOf(this),
          ) ?? [];

        const payload = args.changeSet?.payload as Record<string, unknown>;

        for (const key of properties) {
          const value = payload?.[key];

          // Skip if value is not a string or is already a JWE
          if (typeof value !== "string" || isJwe(value)) {
            continue;
          }

          (this as Record<string, unknown>)[key] =
            await CryptService.encrypt(value);
        }
      };

      Object.defineProperty(target, "__encryptProperties__", {
        value: encryptProperties,
        writable: true,
        configurable: true,
      });

      BeforeCreate()(target, "__encryptProperties__");
      BeforeUpdate()(target, "__encryptProperties__");
    }
  };
}
