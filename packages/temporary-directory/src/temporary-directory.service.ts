import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";

import { RequestContext } from "@nest-boot/request-context";
import { Injectable } from "@nestjs/common";

import { TEMPORARY_DIRECTORY_ROOT } from "./temporary-directory.constants";

/** Allocates temporary directories within the current request context. */
@Injectable()
export class TemporaryDirectoryService {
  /** Creates an isolated child directory removed when its request context ends. */
  async create(): Promise<string> {
    if (!RequestContext.isActive()) {
      throw new Error("Temporary directory requires an active RequestContext");
    }

    const root = RequestContext.get<string>(TEMPORARY_DIRECTORY_ROOT);
    if (!root) {
      throw new Error("Temporary directory context is not initialized");
    }

    return await mkdtemp(join(root, "directory-"));
  }
}
