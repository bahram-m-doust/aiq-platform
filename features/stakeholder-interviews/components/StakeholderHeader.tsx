import { cn } from "@/lib/utils";

type StatusBadge = { label: string; className: string };

// Maps the report lifecycle to the status pill shown next to the step label.
// "In review" mirrors the Figma warning badge; other states reuse the same
// pill shape with status-appropriate colors.
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

export function StakeholderHeader({ status }: { status: string }) {
  const badge = STATUS_BADGES[status] ?? STATUS_BADGES.PENDING_UPLOAD;

  return (
    <div className="flex flex-col gap-[9px]">
      <div className="flex items-center gap-4">
        <span className="text-[12px] leading-4 tracking-[-0.072px] text-muted-foreground">
          Brand Research · Step 02
        </span>
        <span
          className={cn(
            "inline-flex items-center rounded-md border px-2 py-0.5 text-[12px] font-semibold leading-4",
            badge.className,
          )}
        >
          {badge.label}
        </span>
      </div>

      <h1 className="text-xl font-semibold leading-7 tracking-[-0.01em] text-foreground">
        Stakeholder Interviews
      </h1>

      <p className="max-w-[545px] text-[12px] leading-4 tracking-[-0.072px] text-muted-foreground">
        The Bextudio team has analysed the interviews with your brand team.
        Review the report below, leave comments anywhere on the document, and
        approve it when you are happy — that unlocks Futures Research.
      </p>
    </div>
  );
}
