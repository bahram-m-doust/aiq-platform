type TemporaryEnvPatch = Record<string, string | undefined>;

export function withTemporaryEnv<T>(
  patch: TemporaryEnvPatch,
  assertion: () => T,
) {
  const previous = new Map(
    Object.keys(patch).map((key) => [key, process.env[key]]),
  );

  try {
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });

    return assertion();
  } finally {
    previous.forEach((value, key) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }
}

export function withOriginEnv<T>(
  env: { appBaseUrl?: string; adminBaseUrl?: string },
  assertion: () => T,
) {
  return withTemporaryEnv(
    {
      APP_BASE_URL: env.appBaseUrl,
      ADMIN_BASE_URL: env.adminBaseUrl,
    },
    assertion,
  );
}
