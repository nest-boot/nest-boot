import { DEFAULT_MASTRA_SERVER_PREFIX } from "../mastra.constants.js";
import {
  normalizeMastraServerOptions,
  normalizeMastraStudioOptions,
  resolveMastraServerPrefix,
  resolveMastraStudioBasePath,
} from "./normalize-mastra-options.util.js";

describe("normalize-mastra-options.util", () => {
  it("normalizes server and studio prefixes and defaults", () => {
    expect(resolveMastraServerPrefix()).toBe(DEFAULT_MASTRA_SERVER_PREFIX);
    expect(resolveMastraServerPrefix("/")).toBe("/api");
    expect(resolveMastraStudioBasePath("/custom/")).toBe("/custom/studio");

    expect(normalizeMastraServerOptions()).toEqual({
      enabled: false,
      serverOptions: { prefix: DEFAULT_MASTRA_SERVER_PREFIX },
    });
    expect(normalizeMastraServerOptions(false)).toEqual({
      enabled: false,
      serverOptions: { prefix: DEFAULT_MASTRA_SERVER_PREFIX },
    });
    expect(normalizeMastraServerOptions(true)).toEqual({
      enabled: true,
      serverOptions: { prefix: DEFAULT_MASTRA_SERVER_PREFIX },
    });
    expect(
      normalizeMastraServerOptions({
        enabled: false,
        prefix: "/v2/mastra",
        rateLimitOptions: { enabled: false },
      }),
    ).toEqual({
      enabled: false,
      serverOptions: {
        prefix: "/v2/mastra",
        rateLimitOptions: { enabled: false },
      },
    });

    expect(normalizeMastraStudioOptions()).toEqual({
      enabled: false,
      hideCloudCta: true,
      telemetryDisabled: true,
    });
    expect(normalizeMastraStudioOptions(undefined, true)).toEqual({
      enabled: true,
      hideCloudCta: true,
      telemetryDisabled: true,
    });
    expect(normalizeMastraStudioOptions(true, false)).toEqual({
      enabled: true,
      hideCloudCta: true,
      telemetryDisabled: true,
    });
    expect(normalizeMastraStudioOptions(false, true)).toEqual({
      enabled: false,
      hideCloudCta: true,
      telemetryDisabled: true,
    });
    expect(
      normalizeMastraStudioOptions(
        { enabled: true, hideCloudCta: false, telemetryDisabled: false },
        false,
      ),
    ).toEqual({
      enabled: true,
      hideCloudCta: false,
      telemetryDisabled: false,
    });
  });

  it("rejects invalid server and studio option shapes", () => {
    expect(() => resolveMastraServerPrefix(123 as never)).toThrow(
      "Mastra server.prefix must be a string",
    );
    expect(() => normalizeMastraServerOptions("false" as never)).toThrow(
      "Mastra server option must be a boolean or an options object",
    );
    expect(() => normalizeMastraServerOptions([] as never)).toThrow(
      "Mastra server option must be a boolean or an options object",
    );
    expect(() =>
      normalizeMastraServerOptions({ enabled: "false" as never }),
    ).toThrow("Mastra server.enabled must be a boolean");

    expect(() => normalizeMastraStudioOptions("false" as never)).toThrow(
      "Mastra studio option must be a boolean or an options object",
    );
    expect(() =>
      normalizeMastraStudioOptions({ enabled: "false" as never }),
    ).toThrow("Mastra studio.enabled must be a boolean");
    expect(() =>
      normalizeMastraStudioOptions({ hideCloudCta: "false" as never }),
    ).toThrow("Mastra studio.hideCloudCta must be a boolean");
    expect(() =>
      normalizeMastraStudioOptions({ telemetryDisabled: "false" as never }),
    ).toThrow("Mastra studio.telemetryDisabled must be a boolean");
  });
});
