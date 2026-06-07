export function isEnvTrue(name: string): boolean {
  return process.env[name] === "true";
}
