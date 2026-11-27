import type { JwksOptions } from "../interfaces/jwks-options.interface.js";

const thirtyDays = 60 * 60 * 24 * 30;
const literalPath = /^\/(?:[A-Za-z0-9_~.-]+\/)*[A-Za-z0-9_~.-]+$/;

/**
 * Resolves JWKS configuration shared by signing, verification, and routing.
 * @param options - User-supplied JWKS overrides.
 * @returns Validated JWKS configuration with defaults filled in.
 */
export function resolveJwksOptions(
  options: JwksOptions = {},
): Required<Omit<JwksOptions, "controllerDecorator">> {
  const {
    path = "/.well-known/jwks.json",
    keyPairConfig = { alg: "EdDSA", crv: "Ed25519" },
    rotationInterval = thirtyDays,
    gracePeriod = thirtyDays,
  } = options;

  if (
    path.trim() !== path ||
    !literalPath.test(path) ||
    /(?:^|\/)\.{1,2}(?:\/|$)/.test(path)
  ) {
    throw new Error("JWKS path must be a literal absolute path");
  }
  if (!Number.isSafeInteger(rotationInterval) || rotationInterval < 1) {
    throw new Error(
      "JWKS rotationInterval must be a positive number of seconds",
    );
  }
  if (!Number.isSafeInteger(gracePeriod) || gracePeriod < 0) {
    throw new Error(
      "JWKS gracePeriod must be a non-negative number of seconds",
    );
  }
  if (
    "modulusLength" in keyPairConfig &&
    keyPairConfig.modulusLength !== undefined &&
    (!Number.isSafeInteger(keyPairConfig.modulusLength) ||
      keyPairConfig.modulusLength < 2048)
  ) {
    throw new Error("JWKS RSA modulusLength must be at least 2048 bits");
  }
  return { path, keyPairConfig, rotationInterval, gracePeriod };
}
