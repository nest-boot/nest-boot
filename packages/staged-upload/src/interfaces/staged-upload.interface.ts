/** One form field required by a staged upload request. */
export interface StagedUploadField {
  /** Form field name. */
  name: string;

  /** Form field value. */
  value: string;
}

/** File metadata used to create a staged upload. */
export interface StagedUploadRequest {
  /** Original file name including its extension. */
  name: string;

  /** File size in bytes. */
  fileSize: number;

  /** MIME type reported for the file. */
  mimeType: string;
}

/** Presigned POST data returned for a staged upload. */
export interface StagedUploadResult {
  /** Form fields that must accompany the upload. */
  fields: StagedUploadField[];

  /** Presigned POST destination URL. */
  url: string;
}
