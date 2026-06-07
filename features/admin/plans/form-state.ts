// Server-action modules may only export async functions, so the shared
// form-state type and initial value live in this plain module.

export type PlanFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialPlanFormState: PlanFormState = {
  status: "idle",
  message: "",
};
