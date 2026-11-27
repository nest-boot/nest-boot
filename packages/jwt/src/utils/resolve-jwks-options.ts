import type {
  JwksOptions,
  JwtAlgorithm,
} from "../interfaces/jwks-options.interface.js";

const thirtyDays = 60 * 60 * 24 * 30;
const literalPath = /^\/(?:[A-Za-z0-9_~.-]+\/)*[A-Za-z0-9_~.-]+$/;
const allowedAlgorithms = new Set<JwtAlgorithm>(["Ed25519", "ES256", "ES512"]);

export interface ResolvedJwksOptions {
  path: string;
  alg: JwtAlgorithm;
  rotationInterval: number | undefined;
  gracePeriod: number;
}

/**
 * Resolves JWKS configuration shared by signing, verification, and routing.
 * @param options - User-supplied JWKS overrides.
 * @returns Validated JWKS configuration with defaults filled in.
 */
export function resolveJwksOptions(
  options: JwksOptions = {},
): ResolvedJwksOptions {
  const {
    path = "/.well-known/jwks.json",
    alg = "Ed25519",
    rotationInterval,
    gracePeriod = thirtyDays,
  } = options;

  if (
    path.trim() !== path ||
    !literalPath.test(path) ||
    /(?:^|\/)\.{1,2}(?:\/|$)/.test(path)
  ) {
    throw new Error("JWKS path must be a literal absolute path");
  }
  if (!allowedAlgorithms.has(alg)) {
    throw new Error("JWKS alg must be Ed25519, ES256, or ES512");
  }
  if (
    rotationInterval !== undefined &&
    (!Number.isSafeInteger(rotationInterval) || rotationInterval < 1)
  ) {
    throw new Error(
      "JWKS rotationInterval must be a positive number of seconds",
    );
  }
  if (!Number.isSafeInteger(gracePeriod) || gracePeriod < 0) {
    throw new Error(
      "JWKS gracePeriod must be a non-negative number of seconds",
    );
  }
  return { path, alg, rotationInterval, gracePeriod };
}
