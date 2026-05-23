export class DomainError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

export function isDomainErrorWithCode(
  error: unknown,
  code: string,
): error is DomainError {
  return isDomainError(error) && error.code === code;
}
