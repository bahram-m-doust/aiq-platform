import "server-only";

function stringFromUnknown(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getOpenAIErrorParts(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: stringFromUnknown(error), status: null, code: "", type: "" };
  }

  const record = error as {
    message?: unknown;
    status?: unknown;
    code?: unknown;
    type?: unknown;
  };

  return {
    message: stringFromUnknown(record.message),
    status: typeof record.status === "number" ? record.status : null,
    code: stringFromUnknown(record.code),
    type: stringFromUnknown(record.type),
  };
}

export function toOpenAIUserErrorMessage(error: unknown): string | null {
  const { message, status, code, type } = getOpenAIErrorParts(error);
  const haystack = `${status ?? ""} ${code} ${type} ${message}`.toLowerCase();

  if (
    code === "insufficient_quota" ||
    haystack.includes("exceeded your current quota") ||
    haystack.includes("check your plan and billing")
  ) {
    return "OpenAI quota or billing limit has been reached. Ask a Platform Owner to check OpenAI billing or replace the key in AI Studio.";
  }

  if (
    status === 401 ||
    haystack.includes("invalid api key") ||
    haystack.includes("incorrect api key")
  ) {
    return "OpenAI API key is invalid. Ask a Platform Owner to update the key in AI Studio.";
  }

  if (
    status === 404 &&
    haystack.includes("vector store") &&
    haystack.includes("not found")
  ) {
    return "OpenAI vector store is no longer available for the current API key. Ask a Platform Owner to rebuild Brand Brain.";
  }

  if (status === 429 || haystack.includes("rate limit")) {
    return "OpenAI is rate limiting requests. Try again shortly.";
  }

  if (status !== null && status >= 500) {
    return "OpenAI is temporarily unavailable. Try again shortly.";
  }

  return null;
}
