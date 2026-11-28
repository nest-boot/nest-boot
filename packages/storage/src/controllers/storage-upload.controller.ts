import {
  BadRequestException,
  Body,
  Controller,
  Post,
  VERSION_NEUTRAL,
} from "@nestjs/common";

import type {
  StorageTemporaryFileUploadRequest,
  StorageTemporaryFileUploadUrl,
} from "../interfaces/storage-upload-options.interface.js";
import { StorageService } from "../storage.service.js";
import { MAX_TEMPORARY_FILE_UPLOAD_BATCH_SIZE } from "../storage-upload-limits.constants.js";
import { DEFAULT_STORAGE_UPLOAD_PATH } from "../utils/resolve-storage-route-path.util.js";

/** REST controller that issues presigned temporary file upload URLs. */
@Controller({
  path: DEFAULT_STORAGE_UPLOAD_PATH,
  version: VERSION_NEUTRAL,
})
export class StorageUploadController {
  /**
   * Creates a StorageUploadController instance.
   * @param storage - Storage service that validates limits and signs temporary uploads.
   */
  constructor(private readonly storage: StorageService) {}

  /**
   * Issues presigned POST targets in `tmp/` for a batch of requested files.
   * @param body - JSON payload containing a `files` array of upload descriptors.
   * @returns Object containing the generated `uploads` array.
   */
  @Post()
  async createTemporaryFileUploadUrls(
    @Body() body: unknown,
  ): Promise<{ uploads: StorageTemporaryFileUploadUrl[] }> {
    if (
      typeof body !== "object" ||
      body === null ||
      !Array.isArray((body as { files?: unknown }).files)
    ) {
      throw new BadRequestException("Request body must contain a files array");
    }

    const { files } = body as { files: unknown[] };
    if (files.length > MAX_TEMPORARY_FILE_UPLOAD_BATCH_SIZE) {
      throw new BadRequestException(
        `Cannot create more than ${String(MAX_TEMPORARY_FILE_UPLOAD_BATCH_SIZE)} temporary file upload URLs per request`,
      );
    }

    const uploads = await Promise.all(
      files.map((file) =>
        this.storage.createTemporaryFileUploadUrl(
          file as StorageTemporaryFileUploadRequest,
        ),
      ),
    );

    return { uploads };
  }
}
