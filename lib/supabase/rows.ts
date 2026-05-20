export function rowsOrEmpty<T>(data: unknown) {
  return Array.isArray(data) ? (data as T[]) : [];
}

export function rowOrNull<T>(data: unknown) {
  return data ? (data as T) : null;
}

export function rowAsArray<T>(data: unknown) {
  const row = rowOrNull<T>(data);
  return row ? [row] : [];
}
