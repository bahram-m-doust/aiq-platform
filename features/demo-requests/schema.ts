import {
  demoRequestStatuses,
  type DemoRequestRecord,
  type DemoRequestStatus,
} from "@/features/demo-requests/types";

const MAX_MESSAGE_LENGTH = 1000;

export function isDemoRequestStatus(value: string): value is DemoRequestStatus {
  return demoRequestStatuses.includes(value as DemoRequestStatus);
}

export function validateCreateDemoRequestFormData(formData: FormData): {
  message: string | null;
  error: string | null;
} {
  const raw = formData.get("message");
  if (raw === null || raw === undefined) {
    return { message: null, error: null };
  }
  if (typeof raw !== "string") {
    return { message: null, error: "Message could not be read." };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { message: null, error: null };
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return {
      message: null,
      error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`,
    };
  }
  return { message: trimmed, error: null };
}

export function readDemoRequestId(formData: FormData): {
  id: string | null;
  error: string | null;
} {
  const raw = formData.get("demo_request_id");
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { id: null, error: "Missing demo request identifier." };
  }
  return { id: raw.trim(), error: null };
}

export function readResolutionNote(formData: FormData): string | null {
  const raw = formData.get("resolution_note");
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, MAX_MESSAGE_LENGTH);
}

export function toDemoRequestAuditMetadata(request: DemoRequestRecord) {
  return {
    id: request.id,
    email: request.email,
    status: request.status,
    approved_access_key_id: request.approvedAccessKeyId,
  };
}
