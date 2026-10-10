/** Format field/schema and form-level errors without exposing object values. */
export function getFormErrorMessage(errors: ReadonlyArray<unknown>) {
  const messages = errors.flatMap((error) => {
    if (typeof error === "string") return [error];
    if (
      error &&
      typeof error === "object" &&
      "message" in error &&
      typeof error.message === "string"
    )
      return [error.message];
    return [];
  });
  return [...new Set(messages)].join(", ") || undefined;
}
