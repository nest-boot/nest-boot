import { JwtService } from "@nest-boot/jwt";

import {
  OPTIONAL_JWT_SERVICE_TOKEN,
  resolveOptionalJwtServiceToken,
} from "./optional-jwt.util.js";

describe("resolveOptionalJwtServiceToken", () => {
  it("resolves JwtService when @nest-boot/jwt is installed", () => {
    expect(OPTIONAL_JWT_SERVICE_TOKEN).toBe(JwtService);
  });

  it("returns a fallback symbol when @nest-boot/jwt itself is not installed", async () => {
    const missingEsmError = Object.assign(
      new Error("Cannot find package '@nest-boot/jwt' imported from storage"),
      { code: "ERR_MODULE_NOT_FOUND" },
    );
    const missingCjsError = Object.assign(
      new Error("Cannot find module '@nest-boot/jwt'"),
      { code: "MODULE_NOT_FOUND" },
    );

    await expect(
      resolveOptionalJwtServiceToken(() => Promise.reject(missingEsmError)),
    ).resolves.toEqual(expect.any(Symbol));
    await expect(
      resolveOptionalJwtServiceToken(() => Promise.reject(missingCjsError)),
    ).resolves.toEqual(expect.any(Symbol));
  });

  it("rethrows broken transitive dependencies inside @nest-boot/jwt and unrelated errors", async () => {
    const transitiveError = Object.assign(
      new Error(
        "Cannot find package 'jose' imported from /app/node_modules/@nest-boot/jwt/dist/index.js",
      ),
      { code: "ERR_MODULE_NOT_FOUND" },
    );

    await expect(
      resolveOptionalJwtServiceToken(() => Promise.reject(transitiveError)),
    ).rejects.toThrow("Cannot find package 'jose'");
    await expect(
      resolveOptionalJwtServiceToken(() => Promise.reject(new Error("boom"))),
    ).rejects.toThrow("boom");
    await expect(
      resolveOptionalJwtServiceToken(() =>
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        Promise.reject("raw"),
      ),
    ).rejects.toBe("raw");
  });
});
