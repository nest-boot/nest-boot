/**
 * Normalizes a storage path with redundant separators and dot segments removed.
 * @param path - Storage path or root prefix to normalize.
 * @returns Normalized relative path without leading or trailing slashes.
 */
export function normalizeStoragePath(path: string): string {
  const parts = path.replaceAll("\\", "/").split("/");
  const normalized: string[] = [];

  for (const part of parts) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      throw new TypeError("Storage paths must not contain '..' segments");
    }
    normalized.push(part);
  }

  return normalized.join("/");
}
