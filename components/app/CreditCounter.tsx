type CreditCounterProps = {
  credits: number;
};

/**
 * Compact credits counter rendered in the sidebar footer card.
 *
 * `credits` is the active brand plan's credit allowance (0 when the brand has
 * no plan or the plan grants none).
 */
export function CreditCounter({ credits }: CreditCounterProps) {
  return (
    <div className="flex items-center justify-between px-2.5 py-2.5">
      <span className="text-sm font-medium text-foreground">Credits</span>
      <span className="text-sm text-muted-foreground">
        {credits.toLocaleString()}
      </span>
    </div>
  );
}
