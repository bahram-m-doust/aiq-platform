export function readRuntimeEnv(name: string) {
  return process.env[name];
}

export function readTrimmedRuntimeEnv(name: string) {
  return readRuntimeEnv(name)?.trim() ?? "";
}
