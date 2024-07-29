export function tryRequire<T>(name: string): T | undefined {
  try {
    return require(name);
  } catch {}
}
