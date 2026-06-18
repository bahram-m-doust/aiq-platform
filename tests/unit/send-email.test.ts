import { afterEach, describe, expect, it, vi } from "vitest";

import { sendEmailWithResend } from "@/lib/email/sendEmail";

const input = {
  to: "owner@example.com",
  subject: "Hi",
  text: "hello",
  html: "<p>hello</p>",
};

function configureEmailEnv() {
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("EMAIL_FROM", "Bextudio <no-reply@example.com>");
}

describe("sendEmailWithResend", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("degrades to RESEND_SEND_FAILED when the request aborts/times out", async () => {
    configureEmailEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("Aborted", "TimeoutError")),
    );

    const result = await sendEmailWithResend(input);

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ code: "RESEND_SEND_FAILED" });
  });

  it("short-circuits to a config error before calling fetch", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await sendEmailWithResend(input);

    expect(result).toMatchObject({ code: "MISSING_RESEND_API_KEY" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends with an abort signal so a hung upstream can't block forever", async () => {
    configureEmailEnv();
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "email-1" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    const result = await sendEmailWithResend(input);

    expect(result).toEqual({ ok: true, id: "email-1" });
    const init = fetchSpy.mock.calls[0][1];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
