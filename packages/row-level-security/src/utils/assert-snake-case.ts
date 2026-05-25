export function assertSnakeCase(value: string, label: string) {
  if (!/^[a-z]+(_[a-z]+)*$/.test(value)) {
    throw new Error(`${label} must be snake_case: ${value}`);
  }
}
