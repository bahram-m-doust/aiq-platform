import { cn } from "@/lib/utils";

const colorClasses = {
  orange: "bg-orange-500",
  blue: "bg-blue-500",
  green: "bg-[linear-gradient(90deg,#06B6D4_0%,#2DD4BF_52%,#7CFF6B_100%)]",
  "green-soft": "bg-[#10B981]/45",
  muted: "bg-muted-foreground/30",
};

const trackClasses: Record<keyof typeof colorClasses, string> = {
  orange: "bg-orange-500/20",
  blue: "bg-blue-500/20",
  green: "bg-[#CFF1E6]",
  "green-soft": "bg-[#10B981]/15",
  muted: "bg-muted",
};

export function ProgressBar({
  value,
  color = "blue",
  className,
}: {
  value: number;
  color?: keyof typeof colorClasses;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full",
        trackClasses[color],
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500 ease-out",
          colorClasses[color],
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
