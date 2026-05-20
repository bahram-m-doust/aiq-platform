import "server-only";

export class ModuleServiceError extends Error {
  name = "ModuleServiceError";
}

export function moduleServiceError(message: string): never {
  throw new ModuleServiceError(message);
}

export function isModuleServiceError(
  error: unknown,
): error is ModuleServiceError {
  return error instanceof ModuleServiceError;
}
