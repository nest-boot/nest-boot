import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  Redirect,
} from "@nestjs/common";

import {
  STORAGE_DOWNLOAD_PATH,
  StorageDownloadService,
} from "../services/storage-download.service.js";

/** Validates storage download requests and redirects to S3. */
@Controller(STORAGE_DOWNLOAD_PATH)
export class StorageDownloadController {
  constructor(private readonly downloads: StorageDownloadService) {}

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
