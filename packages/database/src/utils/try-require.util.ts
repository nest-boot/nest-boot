// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function tryRequire<T>(name: string): T | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(name);
  } catch {}
}
