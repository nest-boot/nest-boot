/**
 * Returns whether the environment variable is exactly the string `true`.
 * @param name - Name used to identify the resource.
 * @returns Whether the environment variable is exactly the string `true`.
 */
export function isEnvTrue(name: string): boolean {
  return process.env[name] === "true";
}
