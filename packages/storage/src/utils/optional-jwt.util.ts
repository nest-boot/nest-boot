import type { Abstract, InjectionToken } from "@nestjs/common";

const JWT_PACKAGE_SPECIFIER = "@nest-boot/jwt";
const MISSING_JWT_PACKAGE_PATTERN =
  /Cannot find (?:package|module) ['"]@nest-boot\/jwt['"]/;
const UNINSTALLED_JWT_SERVICE = Symbol("UNINSTALLED_JWT_SERVICE");

/** Minimal JWT claim set signed and verified for storage download links. */
export interface StorageJwtPayload {
  /** Expiration timestamp in seconds since the Unix epoch. */
  exp?: number;
  [propName: string]: unknown;
}

/**
 * Package-local structural contract matching `@nest-boot/jwt`'s `JwtService`
 * so public TypeScript declarations never require the optional peer dependency.
 */
export interface StorageJwtService {
  /** Signs a scoped download JWT payload. */
  sign(
    payload: StorageJwtPayload,
    options: {
      audience: string;
      expiresIn: number;
      subject: string;
      type: string;
    },
  ): Promise<string>;
  /** Verifies a scoped download JWT token and returns its claims. */
  verify(
    token: string,
    options: {
      audience: string;
      type: string;
    },
  ): Promise<StorageJwtPayload>;
}

/**
 * Resolves the Nest injection token for optional `@nest-boot/jwt` `JwtService`.
 * @param loader - Async module loader (defaults to `import("@nest-boot/jwt")`).
 * @returns `JwtService` token when installed, or a private fallback symbol when omitted.
 */
export async function resolveOptionalJwtServiceToken(
  loader: () => Promise<{ JwtService: Abstract<StorageJwtService> }> = () =>
    import(JWT_PACKAGE_SPECIFIER) as Promise<{
      JwtService: Abstract<StorageJwtService>;
    }>,
): Promise<InjectionToken<StorageJwtService>> {
  try {
    const mod = await loader();
    return mod.JwtService;
  } catch (error) {
    if (isMissingJwtPackageError(error)) {
      return UNINSTALLED_JWT_SERVICE;
    }
    throw error;
  }
}

/**
 * Checks whether a dynamic import failure indicates that `@nest-boot/jwt` itself is not installed
 * (while surfacing broken transitive imports inside an installed `@nest-boot/jwt`).
 * @param error - Thrown module resolution error.
 * @returns True when `@nest-boot/jwt` itself could not be found.
 */
function isMissingJwtPackageError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const candidate = error as { code?: string; message?: string };
  return (
    (candidate.code === "ERR_MODULE_NOT_FOUND" ||
      candidate.code === "MODULE_NOT_FOUND") &&
    typeof candidate.message === "string" &&
    MISSING_JWT_PACKAGE_PATTERN.test(candidate.message)
  );
}

/** Nest injection token for optional `@nest-boot/jwt` integration. */
export const OPTIONAL_JWT_SERVICE_TOKEN: InjectionToken<StorageJwtService> =
  await resolveOptionalJwtServiceToken();
