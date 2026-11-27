import { type PropertyOptions } from "@mikro-orm/core";

/**
 * Configuration options for the `@EncryptedProperty()` decorator.
 * @template T - Entity type owning the decorated property
 */
export interface EncryptedPropertyOptions<
  T extends object = object,
> extends PropertyOptions<T> {
  /**
   * Optional HKDF domain-separation context passed to `CryptService.encrypt()`.
   * When omitted, values are encrypted using the root `CryptService` key.
   */
  context?: string;
}
