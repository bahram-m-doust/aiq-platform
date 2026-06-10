import { cn } from "@/lib/utils";

type StatusBadge = { label: string; className: string };

// The status pill shown for every review deliverable (stakeholder interviews,
// futures research, city model districts) — one source of truth for the
// lifecycle → label + colour mapping.
const STATUS_BADGES: Record<string, StatusBadge> = {
  PENDING_UPLOAD: {
    label: "Preparing",
    className: "border-border bg-muted text-muted-foreground",
  },
  CLIENT_REVIEW: {
    label: "In review",
    className: "border-[#fdf5d3] bg-[#fffcf0] text-[#dc7609]",
  },
  CHANGES_REQUESTED: {
    label: "Changes requested",
    className: "border-[#fdf5d3] bg-[#fffcf0] text-[#dc7609]",
  },
  APPROVED: {
    label: "Approved",
    className: "border-[#bbf7d0] bg-[#f0fdf4] text-[#008a2e]",
  },
};

export function DeliverableStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const badge = STATUS_BADGES[status] ?? STATUS_BADGES.PENDING_UPLOAD;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[12px] font-semibold leading-4",
        badge.className,
        className,
      )}
    >
      {badge.label}
    </span>
  );
}
