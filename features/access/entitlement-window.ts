export function isCurrentActiveEntitlementWindow({
  status,
  startsAt,
  expiresAt,
  now = new Date(),
}: {
  status: string;
  startsAt: string | null;
  expiresAt: string | null;
  now?: Date;
}) {
  if (status !== "ACTIVE") return false;

  const nowTime = now.getTime();
  const startsAtTime = startsAt ? Date.parse(startsAt) : null;
  const expiresAtTime = expiresAt ? Date.parse(expiresAt) : null;

  if (startsAtTime !== null && Number.isNaN(startsAtTime)) return false;
  if (expiresAtTime !== null && Number.isNaN(expiresAtTime)) return false;
  if (startsAtTime !== null && startsAtTime > nowTime) return false;

  return expiresAtTime === null || expiresAtTime > nowTime;
}
