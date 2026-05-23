import "server-only";

import { DomainError, isDomainErrorWithCode } from "@/lib/errors";

const CODE = "module_service";

export function moduleServiceError(message: string): never {
  throw new DomainError(CODE, message);
}

export function isModuleServiceError(error: unknown): error is DomainError {
  return isDomainErrorWithCode(error, CODE);
}
