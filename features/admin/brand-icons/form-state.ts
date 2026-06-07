// Plain (non-"use server") module: Next.js server-action files may only export
// async functions, so the form-state type and its initial value live here and
// are shared by the action and the client form.

export type BrandIconUploadFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialBrandIconUploadFormState: BrandIconUploadFormState = {
  status: "idle",
  message: "",
};
