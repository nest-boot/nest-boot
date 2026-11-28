import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  Redirect,
  VERSION_NEUTRAL,
} from "@nestjs/common";

import { RESOLVE_FILE_DOWNLOAD_URL } from "../storage.constants.js";
import { StorageService } from "../storage.service.js";
import { DEFAULT_STORAGE_DOWNLOAD_PATH } from "../utils/resolve-storage-route-path.util.js";

/** Validates storage download requests and redirects to S3. */
@Controller({
  path: DEFAULT_STORAGE_DOWNLOAD_PATH,
  version: VERSION_NEUTRAL,
})
export class StorageDownloadController {
  /**
   * Creates a StorageDownloadController instance.
   * @param storage - Storage service that verifies tokens and signs S3 redirects.
   */
  constructor(private readonly storage: StorageService) {}

  /**
   * Verifies the query download token and redirects the client to S3.
   * @param key - Wildcard path segments identifying the requested file.
   * @param token - Signed JWT download token from the query string.
   * @returns Redirect target descriptor containing the S3 presigned URL.
   */
  // Express 5 path-to-regexp named wildcard; Nest Boot HTTP packages target Express 5.
  @Get("*key")
  @Redirect()
  @Header("Cache-Control", "no-store")
  @Header("X-Content-Type-Options", "nosniff")
  async download(
    @Param("key") key: string[],
    @Query("token") token: unknown,
  ): Promise<{ url: string }> {
    return {
      url: await this.storage[RESOLVE_FILE_DOWNLOAD_URL](key.join("/"), token),
    };
  }
}
