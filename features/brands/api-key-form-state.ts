// Server-action modules may only export async functions, so the shared
// form-state type and initial value live in this plain module.

export type ApiKeyFormState =
  | { status: "idle"; message: string }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

export const initialApiKeyFormState: ApiKeyFormState = {
  status: "idle",
  message: "",
};
