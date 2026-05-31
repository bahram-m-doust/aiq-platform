type CreditCounterProps = {
  remaining?: number;
  total?: number;
};

/**
 * Compact credits counter rendered in the sidebar footer card.
 *
 * Currently fed static default values. Wire `remaining`/`total` to real
 * entitlement/usage data once a credits model exists.
 */
export function CreditCounter({
  remaining = 120,
  total = 1000,
}: CreditCounterProps) {
  return (
    <div className="flex items-center justify-between px-2.5 py-2.5">
      <span className="text-sm font-medium text-foreground">Credits</span>
      <span className="text-sm text-muted-foreground">
        {remaining.toLocaleString()} remaining {total.toLocaleString()}
      </span>
    </div>
  );
}
