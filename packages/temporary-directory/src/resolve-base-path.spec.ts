import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { resolveBasePath } from "./resolve-base-path";

describe("resolveBasePath", () => {
  it.each([undefined, ""])("uses the system temp directory for %p", (value) => {
    expect(resolveBasePath(value)).toBe(tmpdir());
  });

  it("preserves an absolute path", () => {
    expect(resolveBasePath("/var/tmp/nest-app")).toBe("/var/tmp/nest-app");
  });

  it("resolves a relative path from the working directory", () => {
    expect(resolveBasePath("var/temp")).toBe(
      resolve(process.cwd(), "var/temp"),
    );
  });
});
