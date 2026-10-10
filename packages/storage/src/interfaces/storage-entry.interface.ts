/** A file or directory returned by {@link Storage.listEntries}. */
export interface StorageEntry {
  /** Path relative to the configured storage root. */
  path: string;

  /** Entry kind. */
  type: "file" | "directory";

  /** File size in bytes. Omitted for directories or unknown sizes. */
  size?: number;

  /** File modification time reported by S3. */
  lastModified?: Date;

  /** File entity tag reported by S3. */
  etag?: string;
}

/** Options for {@link Storage.listEntries}. */
export interface StorageListEntriesOptions {
  /** Include every descendant instead of only immediate children. */
  recursive?: boolean;
}
