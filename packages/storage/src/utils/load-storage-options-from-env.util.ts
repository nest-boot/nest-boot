import { type StorageModuleOptions } from "../interfaces/storage-module-options.interface.js";

/** Loads storage configuration with explicit options overriding the environment. */
export function loadStorageOptionsFromEnv(
  options: StorageModuleOptions = {},
): StorageModuleOptions {
  const accessKeyId = options.accessKeyId ?? process.env.STORAGE_ACCESS_KEY_ID;
  const bucket = options.bucket ?? process.env.STORAGE_BUCKET;
  const endpointUrl = options.endpointUrl ?? process.env.STORAGE_ENDPOINT_URL;
  const forcePathStyle =
    options.forcePathStyle ??
    (process.env.STORAGE_FORCE_PATH_STYLE
      ? process.env.STORAGE_FORCE_PATH_STYLE.toLowerCase() === "true"
      : undefined);
  const region = options.region ?? process.env.STORAGE_REGION;
  const internalEndpointUrl =
    options.internalEndpointUrl ?? process.env.STORAGE_INTERNAL_ENDPOINT_URL;
  const rootPath = options.rootPath ?? process.env.STORAGE_ROOT_PATH;
  const secretAccessKey =
    options.secretAccessKey ?? process.env.STORAGE_SECRET_ACCESS_KEY;

  return {
    ...(accessKeyId ? { accessKeyId } : {}),
    ...(bucket ? { bucket } : {}),
    ...(endpointUrl ? { endpointUrl } : {}),
    ...(forcePathStyle === undefined ? {} : { forcePathStyle }),
    ...(internalEndpointUrl ? { internalEndpointUrl } : {}),
    ...(region ? { region } : {}),
    ...(rootPath ? { rootPath } : {}),
    ...(secretAccessKey ? { secretAccessKey } : {}),
  };
}
