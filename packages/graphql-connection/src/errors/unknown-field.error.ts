export class UnknownFieldError extends Error {
  constructor(public readonly field: string) {
    super(`Unknown field: ${field}`);
    this.name = "UnknownFieldError";
  }
}
