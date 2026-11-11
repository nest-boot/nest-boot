import type { EntityClass, Ref } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { authorize } from "../../common/utils/authorize.util.js";
import { can } from "../../common/utils/can.util.js";
import type { ApiKeyMetadata } from "../types/api-key-metadata.type.js";

/**
 * Reads a related identity without granting access merely through credential metadata.
 * @param key - Credential whose identity is requested.
 * @param related - Persisted identity reference.
 * @param type - Identity type used for authorization.
 * @param read - Authorized identity lookup.
 * @param self - Whether existing self-profile access is allowed.
 * @returns Visible identity, or null when access is denied.
 */
export async function resolveApiKeyRelation<T extends { id: string }>(
  key: ApiKeyMetadata,
  related: Ref<T> | undefined | null,
  type: EntityClass<T>,
  read: (id: string) => Promise<T | null>,
  self = true,
): Promise<T | null> {
  try {
    authorize("read", key);
    if (!related) {
      return null;
    }
    const current =
      self && RequestContext.isActive()
        ? RequestContext.get<T>(type)
        : undefined;
    if (current && current.id === related.id) {
      return current;
    }
    return can("read", type) ? await read(related.id) : null;
  } catch (error) {
    if (error instanceof ForbiddenException) {
      return null;
    }
    throw error;
  }
}
