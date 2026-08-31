import { type S3ClientConfig } from "@aws-sdk/client-s3";

/** Loads S3 client configuration from the supported environment variables. */
export function loadConfigFromEnv(): S3ClientConfig {
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const endpoint = process.env.S3_ENDPOINT_URL;
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE;
  const region = process.env.S3_REGION;

  return {
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
    ...(endpoint ? { endpoint } : {}),
    ...(forcePathStyle
      ? { forcePathStyle: forcePathStyle.toLowerCase() === "true" }
      : {}),
    ...(region ? { region } : {}),
  };
}
