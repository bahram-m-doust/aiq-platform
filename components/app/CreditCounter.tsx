type AiBudget = {
  monthlyBudgetCents: number | null;
  spentCents: number;
  remainingCents: number | null;
};

type CreditCounterProps = {
  credits: number;
  aiBudget: AiBudget | null;
};

function formatDollars(cents: number): string {
  // Floor to whole cents so any real spend — even the sub-cent cost of a single
  // text turn — visibly moves the figure below the cap (499.8¢ → $4.99, not the
  // misleading $5.00 that rounding would show).
  return `$${(Math.floor(cents) / 100).toFixed(2)}`;
}

export function CreditCounter({ credits, aiBudget }: CreditCounterProps) {
  if (aiBudget) {
    const { monthlyBudgetCents, remainingCents } = aiBudget;

    return (
      <div className="px-2.5 pb-2.5">
        <div className="flex items-center justify-between py-2">
          <span className="text-sm font-medium text-foreground">AI Budget</span>
          <span className="text-sm text-muted-foreground">
            {remainingCents !== null
              ? `${formatDollars(remainingCents)} left`
              : "Unlimited"}
          </span>
        </div>
        {monthlyBudgetCents !== null && remainingCents !== null && monthlyBudgetCents > 0 ? (
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/60 transition-all"
              style={{
                width: `${Math.min(100, Math.round((remainingCents / monthlyBudgetCents) * 100))}%`,
              }}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-2.5 py-2.5">
      <span className="text-sm font-medium text-foreground">Credits</span>
      <span className="text-sm text-muted-foreground">
        {credits.toLocaleString()}
      </span>
    </div>
  );
}
