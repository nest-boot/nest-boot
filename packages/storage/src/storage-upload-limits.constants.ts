import { type StorageUploadLimit } from "./interfaces/storage-upload-options.interface.js";

const MIB = 1024 * 1024;

/** Maximum number of temporary file upload URLs that can be requested in a single REST or GraphQL batch. */
export const MAX_TEMPORARY_FILE_UPLOAD_BATCH_SIZE = 100;

/**
 * Default upload MIME type and byte-size presets applied when `upload.limits` is omitted.
 *
 * Rules are evaluated in order (first matching MIME rule wins), blocking active or executable
 * content such as `text/html`, `image/svg+xml`, scripts, and unverified binaries by default:
 * - Safe raster images: 10 MiB
 * - PDF, Office/OpenDocument, plain text, Markdown, CSV/TSV, JSON: 25 MiB
 * - Audio: 50 MiB
 * - Video: 100 MiB
 * - Common archives (`zip`, `gz`, `tar`, `7z`, `rar`, `bz2`, `zst`): 100 MiB
 */
export const DEFAULT_STORAGE_UPLOAD_LIMITS: readonly StorageUploadLimit[] = [
  {
    fileSize: 10 * MIB,
    mimeTypes: [
      "image/apng",
      "image/avif",
      "image/bmp",
      "image/gif",
      "image/heic",
      "image/heif",
      "image/jpeg",
      "image/png",
      "image/tiff",
      "image/vnd.microsoft.icon",
      "image/webp",
      "image/x-icon",
    ],
  },
  {
    fileSize: 25 * MIB,
    mimeTypes: [
      "application/pdf",
      "application/rtf",
      "application/msword",
      "application/vnd.ms-excel",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.*",
      "application/vnd.oasis.opendocument.*",
      "text/plain",
      "text/csv",
      "text/markdown",
      "text/tab-separated-values",
      "application/json",
    ],
  },
  {
    fileSize: 50 * MIB,
    mimeTypes: ["audio/*"],
  },
  {
    fileSize: 100 * MIB,
    mimeTypes: ["video/*"],
  },
  {
    fileSize: 100 * MIB,
    mimeTypes: [
      "application/zip",
      "application/x-zip-compressed",
      "application/gzip",
      "application/x-gzip",
      "application/x-tar",
      "application/x-7z-compressed",
      "application/vnd.rar",
      "application/x-rar-compressed",
      "application/x-bzip2",
      "application/zstd",
    ],
  },
];
