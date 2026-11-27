import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  Redirect,
  VERSION_NEUTRAL,
} from "@nestjs/common";

import { StorageDownloadService } from "../services/storage-download.service.js";
import { DEFAULT_STORAGE_DOWNLOAD_PATH } from "../utils/resolve-storage-download-path.util.js";

/** Validates storage download requests and redirects to S3. */
@Controller({
  path: DEFAULT_STORAGE_DOWNLOAD_PATH,
  version: VERSION_NEUTRAL,
})
export class StorageDownloadController {
  constructor(private readonly downloads: StorageDownloadService) {}

  // Express 5 path-to-regexp named wildcard; Nest Boot HTTP packages target Express 5.
  @Get("*key")
  @Redirect()
  @Header("Cache-Control", "no-store")
  @Header("X-Content-Type-Options", "nosniff")
  async download(
    @Param("key") key: string[],
    @Query("token") token: unknown,
  ): Promise<{ url: string }> {
    return { url: await this.downloads.downloadUrl(key.join("/"), token) };
  }
}
