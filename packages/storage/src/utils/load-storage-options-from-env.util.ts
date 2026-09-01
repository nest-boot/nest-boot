import { type StorageModuleOptions } from "../interfaces/storage-module-options.interface.js";

/** Loads storage configuration with explicit options overriding the environment. */
export function loadStorageOptionsFromEnv(
  options: StorageModuleOptions = {},
): StorageModuleOptions {
  const accessKeyId = options.accessKeyId ?? process.env.STORAGE_ACCESS_KEY_ID;
  const bucket = options.bucket ?? process.env.STORAGE_BUCKET;
  const bucketEndpoint =
    options.bucketEndpoint ?? parseBoolean(process.env.STORAGE_BUCKET_ENDPOINT);
  const endpointUrl = options.endpointUrl ?? process.env.STORAGE_ENDPOINT_URL;
  const forcePathStyle =
    options.forcePathStyle ??
    parseBoolean(process.env.STORAGE_FORCE_PATH_STYLE);
  const region = options.region ?? process.env.STORAGE_REGION;
  const internalBucketEndpoint =
    options.internalBucketEndpoint ??
    parseBoolean(process.env.STORAGE_INTERNAL_BUCKET_ENDPOINT);
  const internalEndpointUrl =
    options.internalEndpointUrl ?? process.env.STORAGE_INTERNAL_ENDPOINT_URL;
  const rootPath = options.rootPath ?? process.env.STORAGE_ROOT_PATH;
  const secretAccessKey =
    options.secretAccessKey ?? process.env.STORAGE_SECRET_ACCESS_KEY;

  return {
    ...(accessKeyId ? { accessKeyId } : {}),
    ...(bucket ? { bucket } : {}),
    ...(bucketEndpoint === undefined ? {} : { bucketEndpoint }),
    ...(endpointUrl ? { endpointUrl } : {}),
    ...(forcePathStyle === undefined ? {} : { forcePathStyle }),
    ...(internalBucketEndpoint === undefined ? {} : { internalBucketEndpoint }),
    ...(internalEndpointUrl ? { internalEndpointUrl } : {}),
    ...(region ? { region } : {}),
    ...(rootPath ? { rootPath } : {}),
    ...(secretAccessKey ? { secretAccessKey } : {}),
  };
}

function parseBoolean(value?: string): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized === "true" : undefined;
}
