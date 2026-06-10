const maxAnnotationLength = 4000;

export function validateReviewAnnotationBody(body: string): {
  value: string | null;
  error: string | null;
} {
  const trimmed = body.trim();
  if (!trimmed) return { value: null, error: "Enter a comment." };
  if (trimmed.length > maxAnnotationLength) {
    return {
      value: null,
      error: `Comment must be ${maxAnnotationLength} characters or fewer.`,
    };
  }
  return { value: trimmed, error: null };
}

export function normalizeReviewPosition(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
