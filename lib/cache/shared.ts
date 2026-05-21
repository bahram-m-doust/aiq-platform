import { unstable_cache } from "next/cache";

type CacheCallback = Parameters<typeof unstable_cache>[0];
type CacheOptions = Parameters<typeof unstable_cache>[2];

export function cacheSharedConfig<T extends CacheCallback>(
  callback: T,
  keyParts: string[],
  options: CacheOptions,
) {
  if (process.env.NODE_ENV === "test") {
    return callback;
  }

  return unstable_cache(callback, keyParts, options) as T;
}
