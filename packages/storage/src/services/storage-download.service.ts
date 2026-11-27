import { JwtService } from "@nest-boot/jwt";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  RequestMethod,
  UnauthorizedException,
} from "@nestjs/common";
import { ApplicationConfig } from "@nestjs/core";

import type { StorageDownloadOptions } from "../interfaces/storage-download-options.interface.js";
import type { StorageModuleOptions } from "../interfaces/storage-module-options.interface.js";
import { Storage } from "../storage.js";
import { MODULE_OPTIONS_TOKEN } from "../storage.module-definition.js";
import { loadStorageOptionsFromEnv } from "../utils/load-storage-options-from-env.util.js";
import { normalizeStoragePath } from "../utils/normalize-storage-path.util.js";
import { resolveStorageDownloadPath } from "../utils/resolve-storage-download-path.util.js";

const scope = { type: "storage-download+jwt", audience: "storage-download" };
const maxPresignedLifetime = 7 * 24 * 60 * 60;

/** Creates and exchanges JWT download links for S3 presigned URLs. */
@Injectable()
export class StorageDownloadService {
  private readonly bucket: string;
  private readonly rootPath: string;
  private readonly origin: string;
  private readonly path: string;
  private readonly expiresIn: number;
  private readonly options: StorageDownloadOptions;

  constructor(
    private readonly storage: Storage,
    private readonly applicationConfig: ApplicationConfig,
    @Optional() @Inject(JwtService) private readonly jwt?: JwtService,
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    options?: StorageModuleOptions,
  ) {
    const resolvedStorage = loadStorageOptionsFromEnv(options);
    const partialStorage = this.storage as Partial<Storage> | undefined;
    this.bucket = (
      partialStorage?.bucket ??
      resolvedStorage.bucket ??
      ""
    ).trim();
    this.rootPath =
      partialStorage?.rootPath ??
      normalizeStoragePath(resolvedStorage.rootPath ?? "");

    const download = options?.download;
    this.options =
      download?.enabled === false ? { enabled: false } : (download ?? {});
    this.path = resolveStorageDownloadPath(this.options.path);
    const base = this.options.baseURL
      ? new URL(this.options.baseURL)
      : undefined;
    if (base && base.protocol !== "http:" && base.protocol !== "https:") {
      throw new Error("Storage download baseURL must use HTTP or HTTPS");
    }
    this.origin = base?.origin ?? "";
    this.expiresIn = this.options.expiresIn ?? 60 * 60;
    if (
      !Number.isSafeInteger(this.expiresIn) ||
      this.expiresIn < 1 ||
      this.expiresIn > maxPresignedLifetime
    ) {
      throw new Error(
        "Storage download expiry must be between 1 and 604800 seconds",
      );
    }
  }

  /**
   * Creates a download link for an object the caller has already authorized.
   * @param key - Canonical object path relative to the storage root.
   * @param subject - Identity for which the caller authorized the download.
   * @returns Application download URL.
   */
  async createUrl(key: string, subject: string): Promise<string> {
    if (this.options.enabled === false) {
      throw new Error("Storage downloads are disabled");
    }
    if (!this.jwt) {
      throw new Error("Storage download links require JwtModule");
    }
    if (!this.bucket) {
      throw new Error(
        "Storage bucket is required; set STORAGE_BUCKET or register StorageModule with a bucket",
      );
    }
    if (
      !this.isObjectKey(key) ||
      this.options.resolveContentType?.(key) === null
    ) {
      throw new BadRequestException("Invalid storage download key");
    }
    const token = await this.jwt.sign(
      {
        bucket: this.bucket,
        ...(this.rootPath ? { rootPath: this.rootPath } : {}),
        key,
      },
      { ...scope, subject, expiresIn: this.expiresIn },
    );
    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    const query = new URLSearchParams({ token });
    return `${this.origin}${this.routePrefix()}${encodedKey}?${query}`;
  }

  /**
   * Extracts the object key from an application download URL.
   * @param url - An absolute or root-relative link.
   * @returns The decoded storage key, when the link matches the download route.
   */
  keyFromUrl(url: string): string | undefined {
    if (this.options.enabled === false) {
      return undefined;
    }
    const pathname = this.extractPathname(url);
    const route = this.routePrefix();
    if (!pathname?.startsWith(route)) {
      return undefined;
    }

    try {
      const key = decodeURIComponent(pathname.slice(route.length));
      return this.isObjectKey(key) ? key : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Exchanges a verified download token for a presigned object URL.
   * @param key - Object path requested by the client.
   * @param token - Download token from the URL.
   * @returns S3 URL with the same expiration deadline.
   */
  async downloadUrl(key: string, token: unknown): Promise<string> {
    if (this.options.enabled === false || !this.jwt) {
      throw new NotFoundException();
    }
    if (typeof token !== "string" || !this.bucket || !this.isObjectKey(key)) {
      throw new UnauthorizedException("Invalid file download");
    }

    const payload = await this.jwt.verify(token, scope);
    if (
      payload.bucket !== this.bucket ||
      (payload.rootPath ?? "") !== this.rootPath ||
      payload.key !== key ||
      payload.exp === undefined
    ) {
      throw new UnauthorizedException("Invalid file download");
    }

    const type = this.options.resolveContentType?.(key);
    const signingDate = new Date();
    const expiresIn =
      Math.floor(payload.exp) - Math.floor(signingDate.getTime() / 1000);
    if (type === null || expiresIn <= 0 || expiresIn > maxPresignedLifetime) {
      throw new UnauthorizedException("Invalid file download");
    }

    // S3 applies ResponseCacheControl to 200 OK responses; partial 206 responses follow stored object metadata.
    return await this.storage.createTemporaryUrl(key, {
      expiresIn,
      signingDate,
      ResponseCacheControl: "no-store",
      ResponseContentType: type,
    });
  }

  private extractPathname(url: string): string | undefined {
    if (url.startsWith("/") && !url.startsWith("//")) {
      return url.split(/[?#]/, 1)[0];
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return undefined;
      }
      if (this.origin && parsed.origin !== this.origin) {
        return undefined;
      }
      return parsed.pathname;
    } catch {
      return undefined;
    }
  }

  private routePrefix(): string {
    const prefix = this.applicationConfig
      .getGlobalPrefix()
      .replace(/^\/+|\/+$/g, "");
    const routePath = `/${this.path}/*key`;
    const excluded = this.applicationConfig
      .getGlobalPrefixOptions()
      .exclude?.some(
        (route) =>
          (route.requestMethod === RequestMethod.ALL ||
            (route.requestMethod as number) === -1 ||
            route.requestMethod === RequestMethod.GET) &&
          route.pathRegex.test(routePath),
      );
    return prefix && !excluded ? `/${prefix}/${this.path}/` : `/${this.path}/`;
  }

  private isObjectKey(key: string): boolean {
    return (
      !key.includes("\\") &&
      key
        .split("/")
        .every(
          (segment) => segment !== "" && segment !== "." && segment !== "..",
        )
    );
  }
}
