import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { RequestContext } from "@nest-boot/request-context";
import { Global, Module } from "@nestjs/common";

import { TEMPORARY_DIRECTORY_ROOT } from "./temporary-directory.constants";
import { TemporaryDirectoryService } from "./temporary-directory.service";

/** Provides request-context-scoped temporary directories. */
@Global()
@Module({
  providers: [TemporaryDirectoryService],
  exports: [TemporaryDirectoryService],
})
export class TemporaryDirectoryModule {
  /** Registers the request-context temporary-directory lifecycle. */
  constructor() {
    RequestContext.registerMiddleware(
      "temporary-directory",
      async (context, next) => {
        const root = join(tmpdir(), `nest-boot-${randomUUID()}`);
        await mkdir(root);
        context.set(TEMPORARY_DIRECTORY_ROOT, root);

        try {
          return await next();
        } finally {
          await rm(root, { force: true, recursive: true });
        }
      },
    );
  }
}
