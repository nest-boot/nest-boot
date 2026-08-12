import { mkdtempDisposable } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  RequestContext,
  RequestContextModule,
} from "@nest-boot/request-context";
import { Global, Module } from "@nestjs/common";

import { TEMPORARY_DIRECTORY_ROOT } from "./temporary-directory.constants";
import { TemporaryDirectoryService } from "./temporary-directory.service";

/** Provides request-context-scoped temporary directories. */
@Global()
@Module({
  imports: [RequestContextModule],
  providers: [TemporaryDirectoryService],
  exports: [TemporaryDirectoryService],
})
export class TemporaryDirectoryModule {
  /** Registers the request-context temporary-directory lifecycle. */
  constructor() {
    RequestContext.registerMiddleware(
      "temporary-directory",
      async (context, next) => {
        await using temporaryDirectory = await mkdtempDisposable(
          join(tmpdir(), "nest-boot-"),
        );
        context.set(TEMPORARY_DIRECTORY_ROOT, temporaryDirectory.path);
        return await next();
      },
    );
  }
}
