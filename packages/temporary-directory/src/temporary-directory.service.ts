import { mkdir, mkdtemp } from "node:fs/promises";
import { join, sep } from "node:path";

import { RequestContext } from "@nest-boot/request-context";
import { Injectable } from "@nestjs/common";

import { TEMPORARY_DIRECTORY_ROOT } from "./temporary-directory.constants";

const NAMESPACE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const INVALID_NAMESPACE_MESSAGE =
  "Temporary directory namespace must be 1-64 characters using only letters, numbers, hyphens, and underscores";

/** Allocates temporary directories within the current request context. */
@Injectable()
export class TemporaryDirectoryService {
  /**
   * Creates an isolated child directory removed when its request context ends.
   *
   * @param namespace - Optional namespace containing only letters, numbers,
   *   hyphens, and underscores, up to 64 characters.
   */
  async create(namespace?: string): Promise<string> {
    if (!RequestContext.isActive()) {
      throw new Error("Temporary directory requires an active RequestContext");
    }

    const root = RequestContext.get<string>(TEMPORARY_DIRECTORY_ROOT);
    if (!root) {
      throw new Error("Temporary directory context is not initialized");
    }

    if (namespace !== undefined && !NAMESPACE_PATTERN.test(namespace)) {
      throw new TypeError(INVALID_NAMESPACE_MESSAGE);
    }

    const parent = namespace === undefined ? root : join(root, namespace);
    if (namespace !== undefined) {
      await mkdir(parent, { recursive: true });
    }

    return await mkdtemp(`${parent}${sep}`);
  }
}
