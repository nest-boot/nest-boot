import { type EventArgs, type PropertyOptions } from "@mikro-orm/core";
import {
  BeforeCreate,
  BeforeUpdate,
  Property,
} from "@mikro-orm/decorators/legacy";
import { CryptService, isJwe } from "@nest-boot/crypt";

import { type EncryptedPropertyOptions } from "./encrypted-property-options.interface.js";

const ENCRYPTED_PROPERTIES_KEY = Symbol("encryptedProperties");
const OWN_ENCRYPTED_KEYS = Symbol("ownEncryptedKeys");

/**
 * Decorator that marks a property as an encrypted field.
 * The property value will be automatically encrypted before create and update operations.
 * @template T - Entity type owning the decorated property
 * @param options - MikroORM property options and optional HKDF context
 * @returns Property decorator that encrypts values before persistence
 * @throws {Error} If context is an empty string or the decorated target is a symbol property
 * @example
 * ```typescript
 * import { t } from '@mikro-orm/core';
 * import { Entity } from '@mikro-orm/decorators/legacy';
 * import { EncryptedProperty } from '@nest-boot/database-crypt';
 *
 * @Entity()
 * export class User {
 *   @EncryptedProperty({ type: t.string, context: 'user:ssn' })
 *   ssn!: string;
 * }
 * ```
 */
export function EncryptedProperty<T extends object>(
  options?: EncryptedPropertyOptions<T>,
): PropertyDecorator {
  const { context, ...propertyOptions } = options ?? {};
  if (
    context !== undefined &&
    (typeof context !== "string" || !context.trim())
  ) {
    throw new Error("EncryptedProperty context must be a non-empty string.");
  }

  return function (target: object, propertyKey: string | symbol) {
    if (typeof propertyKey !== "string") {
      throw new Error(
        "EncryptedProperty decorator can only be used on string properties.",
      );
    }

    Property({
      hidden: true,
      lazy: true,
      ...(propertyOptions as PropertyOptions<T>),
    })(target as T, propertyKey);

    // Clone inherited map once per prototype so subclasses never mutate parent metadata
    const existingProperties = new Map<string, string | undefined>(
      (Reflect.getMetadata(ENCRYPTED_PROPERTIES_KEY, target) as
        | ReadonlyMap<string, string | undefined>
        | undefined) ?? [],
    );
    const ownKeys = new Set<string>(
      (Reflect.getOwnMetadata(OWN_ENCRYPTED_KEYS, target) as
        | ReadonlySet<string>
        | undefined) ?? [],
    );

    if (!ownKeys.has(propertyKey)) {
      ownKeys.add(propertyKey);
      existingProperties.set(propertyKey, context);
    } else if (context !== undefined) {
      existingProperties.set(propertyKey, context);
    }

    Reflect.defineMetadata(OWN_ENCRYPTED_KEYS, ownKeys, target);
    Reflect.defineMetadata(
      ENCRYPTED_PROPERTIES_KEY,
      existingProperties,
      target,
    );

    // Only define encryptProperties method on first decoration
    if (
      !Object.prototype.hasOwnProperty.call(target, "__encryptProperties__")
    ) {
      const encryptProperties = async function <E extends object>(
        this: E,
        args: EventArgs<E>,
      ) {
        const properties =
          (Reflect.getMetadata(
            ENCRYPTED_PROPERTIES_KEY,
            Object.getPrototypeOf(this),
          ) as ReadonlyMap<string, string | undefined> | undefined) ??
          new Map<string, string | undefined>();

        const payload = args.changeSet?.payload as Record<string, unknown>;

        for (const [key, propContext] of properties) {
          const value = payload?.[key];

          // Skip if value is not a string or is already a JWE
          if (typeof value !== "string" || isJwe(value)) {
            continue;
          }

          (this as Record<string, unknown>)[key] = await CryptService.encrypt(
            value,
            propContext !== undefined ? { context: propContext } : undefined,
          );
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
