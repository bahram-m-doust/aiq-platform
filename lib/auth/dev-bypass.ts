export function isDevAuthBypassEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.AIQ_DEV_AUTH_BYPASS === "1"
  );
}
