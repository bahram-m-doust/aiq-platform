import "server-only";

import { readRuntimeEnv } from "@/lib/env/runtime";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type SendEmailResult =
  | {
      ok: true;
      id: string | null;
    }
  | {
      ok: false;
      code: "MISSING_RESEND_API_KEY" | "MISSING_EMAIL_FROM" | "RESEND_SEND_FAILED";
      message: string;
    };

export type ResendEmailConfigResult =
  | {
      ok: true;
      apiKey: string;
      from: string;
    }
  | Extract<SendEmailResult, { ok: false }>;

type ResendResponse = {
  id?: string;
  message?: string;
  name?: string;
};

const emailFromEnvNames = [
  "EMAIL_FROM",
  "RESEND_EMAIL_FROM",
  "RESEND_FROM_EMAIL",
  "FROM_EMAIL",
] as const;

function readFirstRuntimeEnv(names: readonly string[]) {
  for (const name of names) {
    const value = readRuntimeEnv(name)?.trim();
    if (value) {
      return value;
    }
  }
  return "";
}

function timeoutSignal(ms: number) {
  if ("timeout" in AbortSignal) {
    return AbortSignal.timeout(ms);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export function getResendEmailConfig(): ResendEmailConfigResult {
  const apiKey = readRuntimeEnv("RESEND_API_KEY");
  const from = readFirstRuntimeEnv(emailFromEnvNames);

  if (!apiKey) {
    return {
      ok: false,
      code: "MISSING_RESEND_API_KEY",
      message: "Email sending is not configured. Add RESEND_API_KEY.",
    };
  }

  if (!from) {
    return {
      ok: false,
      code: "MISSING_EMAIL_FROM",
      message:
        "Email sending is not configured. Add EMAIL_FROM or RESEND_FROM_EMAIL.",
    };
  }

  return { ok: true, apiKey, from };
}

async function readResendResponse(response: Response) {
  try {
    return (await response.json()) as ResendResponse;
  } catch {
    return {};
  }
}

export async function sendEmailWithResend(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const config = getResendEmailConfig();

  if (!config.ok) {
    return config;
  }

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
      // A hung/slow Resend connection must not tie up the invite / access-key
      // request indefinitely. Degrade to RESEND_SEND_FAILED after 10s — callers
      // already treat that as a non-fatal delivery warning.
      signal: timeoutSignal(10_000),
    });
  } catch {
    return {
      ok: false,
      code: "RESEND_SEND_FAILED",
      message: "Email could not be sent (request timed out or network error).",
    };
  }
  const body = await readResendResponse(response);

  if (!response.ok) {
    return {
      ok: false,
      code: "RESEND_SEND_FAILED",
      message: body.message ?? "Access key email could not be sent.",
    };
  }

  return {
    ok: true,
    id: body.id ?? null,
  };
}
