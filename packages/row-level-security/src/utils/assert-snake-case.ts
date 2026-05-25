/** Asserts that a value is snake_case for use in roles or context keys. */
export function assertSnakeCase(value: string, label: string) {
  if (!/^[a-z]+(_[a-z]+)*$/.test(value)) {
    throw new Error(`${label} must be snake_case: ${value}`);
  }
}
