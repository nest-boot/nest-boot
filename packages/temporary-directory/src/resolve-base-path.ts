import { tmpdir } from "node:os";
import { isAbsolute, resolve } from "node:path";

/** Resolves the configured temporary-directory parent to an absolute path. @internal */
export function resolveBasePath(basePath?: string): string {
  if (!basePath) {
    return tmpdir();
  }

  return isAbsolute(basePath) ? basePath : resolve(process.cwd(), basePath);
}
