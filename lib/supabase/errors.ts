// Postgres "undefined_table" error (42P01). Used to treat a not-yet-migrated
// table as "no data" so pages render instead of crashing.
export function isMissingTableError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "42P01"
  );
}
