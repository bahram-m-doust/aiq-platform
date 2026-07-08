import { describe, expect, it } from "vitest";

import { toOpenAIUserErrorMessage } from "@/lib/openai/errors";

describe("OpenAI user-facing error mapping", () => {
  it("maps quota failures to an actionable safe message", () => {
    const message = toOpenAIUserErrorMessage({
      status: 429,
      code: "insufficient_quota",
      message:
        "You exceeded your current quota, please check your plan and billing details. For more information, read the docs: https://platform.openai.com/docs/guides/error-codes/api-errors.",
    });

    expect(message).toBe(
      "OpenAI quota or billing limit has been reached. Ask a Platform Owner to check OpenAI billing or replace the key in AI Studio.",
    );
    expect(message).not.toContain("https://");
  });

  it("maps invalid key failures without exposing the upstream text", () => {
    expect(
      toOpenAIUserErrorMessage({
        status: 401,
        message: "Incorrect API key provided: sk-test",
      }),
    ).toBe(
      "OpenAI API key is invalid. Ask a Platform Owner to update the key in AI Studio.",
    );
  });

  it("maps missing vector stores after key/project changes", () => {
    expect(
      toOpenAIUserErrorMessage({
        status: 404,
        message:
          "Vector store vs_old not found in organization org_old, project proj_new.",
      }),
    ).toBe(
      "OpenAI vector store is no longer available for the current API key. Ask a Platform Owner to rebuild Brand Brain.",
    );
  });
});
