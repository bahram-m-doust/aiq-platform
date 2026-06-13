// Postgres "undefined_table" error (42P01). Used to treat a not-yet-migrated
// table as "no data" so pages render instead of crashing.
export function isMissingTableError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "42P01"
  );
}

// Postgres "undefined_column" error (42703). Used to fall back to a narrower
// select when a not-yet-migrated column is requested, so a feature that adds a
// column degrades gracefully until its migration is applied.
export function isMissingColumnError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "42703"
  );
}
