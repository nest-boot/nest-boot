import dayjs from "dayjs";

export type ApiKeyStatus = {
  color: "gray" | "green" | "yellow";
  label: "active" | "disabled" | "expired";
};

/** Returns the display status for an API key. */
export function getApiKeyStatus(apiKey: {
  enabled: boolean;
  expiresAt?: string | null;
}): ApiKeyStatus {
  if (!apiKey.enabled) {
    return { color: "gray", label: "disabled" };
  }

  if (apiKey.expiresAt && dayjs(apiKey.expiresAt).isBefore(dayjs())) {
    return { color: "yellow", label: "expired" };
  }

  return { color: "green", label: "active" };
}
